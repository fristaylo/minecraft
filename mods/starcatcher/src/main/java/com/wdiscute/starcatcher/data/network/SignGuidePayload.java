package com.wdiscute.starcatcher.data.network;

import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.data.SignedGuide;
import io.netty.buffer.ByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;

public record SignGuidePayload(String signature) implements CustomPacketPayload
{
    public static final Type<SignGuidePayload> TYPE = new Type<>(Starcatcher.rl("sign_guide"));

    public static final StreamCodec<ByteBuf, SignGuidePayload> STREAM_CODEC = StreamCodec.composite(
            ByteBufCodecs.STRING_UTF8,
            SignGuidePayload::signature,
            SignGuidePayload::new
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
            SignedGuide.SignGuide(signature, context.player());
        });
    }
}
