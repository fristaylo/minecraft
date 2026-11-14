package com.wdiscute.starcatcher.data.network;

import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.registry.SCDataAttachments;
import io.netty.buffer.ByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;

public record SBTrackFishPayload(ResourceLocation fp) implements CustomPacketPayload
{

    public static final Type<SBTrackFishPayload> TYPE = new Type<>(Starcatcher.rl("track_fish"));

    public static final StreamCodec<ByteBuf, SBTrackFishPayload> STREAM_CODEC = StreamCodec.composite(
            ResourceLocation.STREAM_CODEC,
            SBTrackFishPayload::fp,
            SBTrackFishPayload::new
    );

    @Override
    public Type<? extends CustomPacketPayload> type()
    {
        return TYPE;
    }

    public void handle(ServerPlayNetworking.Context context)
    {
        context.server().execute(() ->
        {
            if (context.player().getAttachedOrCreate(SCDataAttachments.TRACKED_FISH).equals(fp))
                context.player().setAttached(SCDataAttachments.TRACKED_FISH, Starcatcher.MISSINGNO);
            else
                context.player().setAttached(SCDataAttachments.TRACKED_FISH, fp);
        });
    }
}
