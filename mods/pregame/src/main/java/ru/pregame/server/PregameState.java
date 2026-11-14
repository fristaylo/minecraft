package ru.pregame.server;

import net.minecraft.nbt.NbtCompound;
import net.minecraft.registry.RegistryWrapper;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.PersistentState;
import ru.pregame.Pregame;

public class PregameState extends PersistentState {
	private static final Type<PregameState> TYPE = new Type<>(PregameState::new, PregameState::fromNbt, null);

	public boolean started;
	public boolean placed;

	public static PregameState get(MinecraftServer server) {
		return server.getOverworld().getPersistentStateManager().getOrCreate(TYPE, Pregame.MOD_ID);
	}

	@Override
	public NbtCompound writeNbt(NbtCompound nbt, RegistryWrapper.WrapperLookup registryLookup) {
		nbt.putBoolean("started", started);
		nbt.putBoolean("placed", placed);
		return nbt;
	}

	private static PregameState fromNbt(NbtCompound nbt, RegistryWrapper.WrapperLookup registryLookup) {
		PregameState state = new PregameState();
		state.started = nbt.getBoolean("started");
		state.placed = nbt.getBoolean("placed");
		return state;
	}
}
