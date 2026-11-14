package ru.pregame.server;

import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.AttackBlockCallback;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.event.player.UseEntityCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.minecraft.block.Block;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.structure.StructurePlacementData;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Identifier;
import net.minecraft.util.TypedActionResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.GameMode;
import net.minecraft.world.World;
import ru.pregame.Pregame;

public final class Lobby {
	public static final RegistryKey<World> KEY = RegistryKey.of(RegistryKeys.WORLD, Identifier.of(Pregame.MOD_ID, "lobby"));

	private static final BlockPos ORIGIN = new BlockPos(-11, 80, -11);
	private static final Vec3d SPAWN = new Vec3d(0.5, 98, 3.5);
	private static final float SPAWN_YAW = 180F;

	private Lobby() {
	}

	public static void init() {
		ServerLifecycleEvents.SERVER_STARTED.register(Lobby::place);
		ServerTickEvents.END_SERVER_TICK.register(Lobby::tick);
		ServerLivingEntityEvents.ALLOW_DAMAGE.register((entity, source, amount) -> !contains(entity.getWorld()));
		PlayerBlockBreakEvents.BEFORE.register((world, player, pos, state, blockEntity) -> !contains(world));
		AttackBlockCallback.EVENT.register((player, world, hand, pos, direction) -> deny(world));
		UseBlockCallback.EVENT.register((player, world, hand, hitResult) -> deny(world));
		AttackEntityCallback.EVENT.register((player, world, hand, entity, hitResult) -> deny(world));
		UseEntityCallback.EVENT.register((player, world, hand, entity, hitResult) -> deny(world));
		UseItemCallback.EVENT.register((player, world, hand) -> contains(world)
			? TypedActionResult.fail(player.getStackInHand(hand))
			: TypedActionResult.pass(player.getStackInHand(hand)));
	}

	public static boolean contains(World world) {
		return world.getRegistryKey().equals(KEY);
	}

	public static void moveToSpawn(ServerPlayerEntity player) {
		player.refreshPositionAndAngles(SPAWN.x, SPAWN.y, SPAWN.z, SPAWN_YAW, 0);
		player.fallDistance = 0;
	}

	public static void admit(ServerPlayerEntity player) {
		player.changeGameMode(GameMode.ADVENTURE);
		player.setHealth(player.getMaxHealth());
		feed(player);
	}

	private static void place(MinecraftServer server) {
		PregameState state = PregameState.get(server);
		if (state.placed) {
			return;
		}
		server.getStructureTemplateManager()
			.getTemplate(Identifier.of(Pregame.MOD_ID, "spawn"))
			.orElseThrow()
			.place(server.getWorld(KEY), ORIGIN, ORIGIN, new StructurePlacementData(), server.getOverworld().getRandom(), Block.NOTIFY_LISTENERS | Block.FORCE_STATE);
		state.placed = true;
		state.markDirty();
		Pregame.LOGGER.info("Lobby island placed at {}", ORIGIN);
	}

	private static void tick(MinecraftServer server) {
		if (PregameState.get(server).started) {
			return;
		}
		for (ServerPlayerEntity player : server.getWorld(KEY).getPlayers()) {
			player.changeGameMode(GameMode.ADVENTURE);
			feed(player);
			if (player.getY() < 60) {
				player.teleport(player.getServerWorld(), SPAWN.x, SPAWN.y, SPAWN.z, SPAWN_YAW, 0);
				player.fallDistance = 0;
			}
		}
	}

	private static void feed(ServerPlayerEntity player) {
		player.getHungerManager().setFoodLevel(20);
		player.getHungerManager().setSaturationLevel(5);
	}

	private static ActionResult deny(World world) {
		return contains(world) ? ActionResult.FAIL : ActionResult.PASS;
	}
}
