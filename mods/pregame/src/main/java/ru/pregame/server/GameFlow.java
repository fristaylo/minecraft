package ru.pregame.server;

import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.GameMode;
import net.minecraft.world.Heightmap;
import net.minecraft.world.World;
import ru.pregame.Pregame;
import ru.pregame.network.PhasePayload;
import ru.pregame.network.PhasePayload.Phase;
import ru.pregame.network.StartGamePayload;

public final class GameFlow {
	private static final int COUNTDOWN_SECONDS = 5;

	private static int countdownTicks = -1;

	private GameFlow() {
	}

	public static void init() {
		ServerLifecycleEvents.SERVER_STARTED.register(server -> countdownTicks = -1);
		ServerTickEvents.END_SERVER_TICK.register(GameFlow::tick);
		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> onJoin(server, handler.getPlayer()));
		ServerPlayNetworking.registerGlobalReceiver(StartGamePayload.ID, (payload, context) -> start(context.server(), context.player()));
	}

	private static void start(MinecraftServer server, ServerPlayerEntity player) {
		if (!player.hasPermissionLevel(2) || PregameState.get(server).started || countdownTicks >= 0) {
			return;
		}
		countdownTicks = 0;
		Pregame.LOGGER.info("Game start countdown initiated by {}", player.getGameProfile().getName());
	}

	private static void tick(MinecraftServer server) {
		if (countdownTicks < 0) {
			return;
		}
		if (countdownTicks == COUNTDOWN_SECONDS * 20) {
			finish(server);
			return;
		}
		if (countdownTicks % 20 == 0) {
			for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
				send(player, Phase.COUNTDOWN, secondsLeft(), false);
			}
		}
		countdownTicks++;
	}

	private static void finish(MinecraftServer server) {
		countdownTicks = -1;
		PregameState state = PregameState.get(server);
		state.started = true;
		state.markDirty();
		for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
			transfer(server, player);
		}
		Pregame.LOGGER.info("Game started");
	}

	private static void onJoin(MinecraftServer server, ServerPlayerEntity player) {
		if (PregameState.get(server).started) {
			if (Lobby.contains(player.getWorld())) {
				transfer(server, player);
			} else {
				send(player, Phase.STARTED, 0, false);
			}
		} else if (countdownTicks < 0) {
			Lobby.admit(server, player);
			send(player, Phase.WAITING, 0, false);
		} else {
			send(player, Phase.COUNTDOWN, secondsLeft(), false);
		}
	}

	private static void transfer(MinecraftServer server, ServerPlayerEntity player) {
		ServerWorld overworld = server.getOverworld();
		BlockPos spawn = overworld.getSpawnPos();
		overworld.getChunk(spawn.getX() >> 4, spawn.getZ() >> 4);
		int y = overworld.getTopY(Heightmap.Type.MOTION_BLOCKING_NO_LEAVES, spawn.getX(), spawn.getZ());
		player.teleport(overworld, spawn.getX() + 0.5, y, spawn.getZ() + 0.5, player.getYaw(), player.getPitch());
		player.changeGameMode(GameMode.SURVIVAL);
		player.getInventory().clear();
		player.setExperienceLevel(0);
		player.setExperiencePoints(0);
		player.totalExperience = 0;
		player.clearStatusEffects();
		player.setHealth(player.getMaxHealth());
		player.getHungerManager().setFoodLevel(20);
		player.getHungerManager().setSaturationLevel(5);
		player.fallDistance = 0;
		player.setSpawnPoint(World.OVERWORLD, null, 0, false, false);
		send(player, Phase.STARTED, 0, true);
	}

	private static int secondsLeft() {
		return COUNTDOWN_SECONDS - countdownTicks / 20;
	}

	private static void send(ServerPlayerEntity player, Phase phase, int seconds, boolean welcome) {
		if (ServerPlayNetworking.canSend(player, PhasePayload.ID)) {
			ServerPlayNetworking.send(player, new PhasePayload(phase, seconds, welcome));
		}
	}
}
