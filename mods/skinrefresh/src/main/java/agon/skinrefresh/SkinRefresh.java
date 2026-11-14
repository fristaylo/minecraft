package agon.skinrefresh;

import agon.skinrefresh.mixin.ServerChunkLoadingManagerInvoker;
import com.mojang.authlib.GameProfile;
import com.mojang.authlib.properties.Property;
import com.mojang.authlib.yggdrasil.ProfileResult;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.network.packet.s2c.play.EntityStatusEffectS2CPacket;
import net.minecraft.network.packet.s2c.play.ExperienceBarUpdateS2CPacket;
import net.minecraft.network.packet.s2c.play.HealthUpdateS2CPacket;
import net.minecraft.network.packet.s2c.play.PlayerListS2CPacket;
import net.minecraft.network.packet.s2c.play.PlayerRemoveS2CPacket;
import net.minecraft.network.packet.s2c.play.PlayerRespawnS2CPacket;
import net.minecraft.network.packet.s2c.play.UpdateSelectedSlotS2CPacket;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.Util;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static net.minecraft.server.command.CommandManager.argument;
import static net.minecraft.server.command.CommandManager.literal;

public class SkinRefresh implements ModInitializer {
	public static final Logger LOGGER = LoggerFactory.getLogger("skinrefresh");

	@Override
	public void onInitialize() {
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
			dispatcher.register(literal("refreshskin")
				.requires(source -> source.hasPermissionLevel(4))
				.then(argument("player", StringArgumentType.word()).executes(context -> {
					MinecraftServer server = context.getSource().getServer();
					String name = StringArgumentType.getString(context, "player");
					ServerPlayerEntity player = server.getPlayerManager().getPlayer(name);
					if (player == null) {
						context.getSource().sendFeedback(() -> Text.literal("Player " + name + " is not online"), false);
						return 0;
					}
					UUID uuid = player.getUuid();
					CompletableFuture
						.supplyAsync(() -> server.getSessionService().fetchProfile(uuid, true), Util.getIoWorkerExecutor())
						.whenComplete((result, error) -> server.execute(() -> apply(server, uuid, result, error)));
					context.getSource().sendFeedback(() -> Text.literal("Refreshing skin of " + name), true);
					return 1;
				}))));
	}

	private static void apply(MinecraftServer server, UUID uuid, ProfileResult result, Throwable error) {
		if (error != null || result == null) {
			LOGGER.warn("Skin fetch failed for {}", uuid, error);
			return;
		}
		ServerPlayerEntity player = server.getPlayerManager().getPlayer(uuid);
		if (player == null) {
			return;
		}
		GameProfile profile = player.getGameProfile();
		profile.getProperties().removeAll("textures");
		for (Property property : result.profile().getProperties().get("textures")) {
			profile.getProperties().put("textures", property);
		}
		refresh(server, player);
		LOGGER.info("Refreshed skin of {}", profile.getName());
	}

	private static void refresh(MinecraftServer server, ServerPlayerEntity player) {
		ServerWorld world = player.getServerWorld();
		ServerChunkLoadingManagerInvoker manager = (ServerChunkLoadingManagerInvoker) world.getChunkManager().chunkLoadingManager;
		manager.skinrefresh$unloadEntity(player);

		server.getPlayerManager().sendToAll(new PlayerRemoveS2CPacket(List.of(player.getUuid())));
		server.getPlayerManager().sendToAll(PlayerListS2CPacket.entryFromPlayer(List.of(player)));

		player.networkHandler.sendPacket(new PlayerRespawnS2CPacket(player.createCommonPlayerSpawnInfo(world), PlayerRespawnS2CPacket.KEEP_ALL));
		player.networkHandler.requestTeleport(player.getX(), player.getY(), player.getZ(), player.getYaw(), player.getPitch());
		server.getPlayerManager().sendWorldInfo(player, world);
		server.getPlayerManager().sendCommandTree(player);
		player.sendAbilitiesUpdate();
		player.networkHandler.sendPacket(new UpdateSelectedSlotS2CPacket(player.getInventory().selectedSlot));
		player.networkHandler.sendPacket(new ExperienceBarUpdateS2CPacket(player.experienceProgress, player.totalExperience, player.experienceLevel));
		player.networkHandler.sendPacket(new HealthUpdateS2CPacket(player.getHealth(), player.getHungerManager().getFoodLevel(), player.getHungerManager().getSaturationLevel()));
		for (StatusEffectInstance effect : player.getStatusEffects()) {
			player.networkHandler.sendPacket(new EntityStatusEffectS2CPacket(player.getId(), effect, false));
		}
		player.playerScreenHandler.syncState();
		player.currentScreenHandler.syncState();

		manager.skinrefresh$loadEntity(player);
	}
}
