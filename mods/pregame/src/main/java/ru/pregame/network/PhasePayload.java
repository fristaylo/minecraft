package ru.pregame.network;

import io.netty.buffer.ByteBuf;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.codec.PacketCodecs;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;
import net.minecraft.util.function.ValueLists;
import ru.pregame.Pregame;

import java.util.function.IntFunction;

public record PhasePayload(Phase phase, int seconds, boolean welcome) implements CustomPayload {
	public static final Id<PhasePayload> ID = new Id<>(Identifier.of(Pregame.MOD_ID, "phase"));
	public static final PacketCodec<RegistryByteBuf, PhasePayload> CODEC = PacketCodec.tuple(
		Phase.CODEC, PhasePayload::phase,
		PacketCodecs.VAR_INT, PhasePayload::seconds,
		PacketCodecs.BOOL, PhasePayload::welcome,
		PhasePayload::new
	);

	@Override
	public Id<? extends CustomPayload> getId() {
		return ID;
	}

	public enum Phase {
		WAITING,
		COUNTDOWN,
		STARTED;

		private static final IntFunction<Phase> BY_ORDINAL = ValueLists.createIdToValueFunction(Phase::ordinal, values(), ValueLists.OutOfBoundsHandling.ZERO);
		public static final PacketCodec<ByteBuf, Phase> CODEC = PacketCodecs.indexed(BY_ORDINAL, Phase::ordinal);
	}
}
