package com.wdiscute.starcatcher.data.network;

import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.fish.FishApi;
import io.netty.buffer.ByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.server.level.ServerPlayer;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;

public record SBFishingCompletedPayload(boolean completed, int time, boolean completedTreasure, boolean perfectCatch,
                                        int hits) implements CustomPacketPayload
{
    public static final Type<SBFishingCompletedPayload> TYPE = new Type<>(Starcatcher.rl("fishing_completed"));

    public static final StreamCodec<ByteBuf, SBFishingCompletedPayload> STREAM_CODEC = StreamCodec.composite(
            ByteBufCodecs.BOOL,
            SBFishingCompletedPayload::completed,
            ByteBufCodecs.INT,
            SBFishingCompletedPayload::time,
            ByteBufCodecs.BOOL,
            SBFishingCompletedPayload::completedTreasure,
            ByteBufCodecs.BOOL,
            SBFishingCompletedPayload::perfectCatch,
            ByteBufCodecs.INT,
            SBFishingCompletedPayload::hits,
            SBFishingCompletedPayload::new
    );

    @Override
    public Type<? extends CustomPacketPayload> type()
    {
        return TYPE;
    }

    public void handle(ServerPlayNetworking.Context context)
    {
        context.server().execute( () ->
                FishApi.spawnFishFromPlayerFishing(((ServerPlayer) context.player()), completed, time, completedTreasure, perfectCatch, hits));
    }
}
