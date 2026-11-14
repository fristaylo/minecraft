package ru.pregame.network;

import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;
import ru.pregame.Pregame;

public record StartGamePayload() implements CustomPayload {
	public static final Id<StartGamePayload> ID = new Id<>(Identifier.of(Pregame.MOD_ID, "start"));
	public static final PacketCodec<RegistryByteBuf, StartGamePayload> CODEC = PacketCodec.unit(new StartGamePayload());

	@Override
	public Id<? extends CustomPayload> getId() {
		return ID;
	}
}
