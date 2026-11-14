package ru.pregame.server;

import net.minecraft.nbt.NbtCompound;
import net.minecraft.nbt.NbtElement;
import net.minecraft.nbt.NbtHelper;
import net.minecraft.nbt.NbtList;
import net.minecraft.registry.RegistryWrapper;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.PersistentState;
import ru.pregame.Pregame;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

public class PregameState extends PersistentState {
	private static final Type<PregameState> TYPE = new Type<>(PregameState::new, PregameState::fromNbt, null);

	public boolean started;
	public boolean placed;
	public final Set<UUID> guided = new HashSet<>();

	public static PregameState get(MinecraftServer server) {
		return server.getOverworld().getPersistentStateManager().getOrCreate(TYPE, Pregame.MOD_ID);
	}

	@Override
	public NbtCompound writeNbt(NbtCompound nbt, RegistryWrapper.WrapperLookup registryLookup) {
		nbt.putBoolean("started", started);
		nbt.putBoolean("placed", placed);
		NbtList list = new NbtList();
		guided.forEach(uuid -> list.add(NbtHelper.fromUuid(uuid)));
		nbt.put("guided", list);
		return nbt;
	}

	private static PregameState fromNbt(NbtCompound nbt, RegistryWrapper.WrapperLookup registryLookup) {
		PregameState state = new PregameState();
		state.started = nbt.getBoolean("started");
		state.placed = nbt.getBoolean("placed");
		nbt.getList("guided", NbtElement.INT_ARRAY_TYPE).forEach(element -> state.guided.add(NbtHelper.toUuid(element)));
		return state;
	}
}
