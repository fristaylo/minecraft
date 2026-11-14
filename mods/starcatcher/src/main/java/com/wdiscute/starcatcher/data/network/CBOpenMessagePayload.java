package com.wdiscute.starcatcher.data.network;

import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.messageinabottle.message.Message;
import com.wdiscute.starcatcher.messageinabottle.message.MessageScreen;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;

public record CBOpenMessagePayload(Message message) implements CustomPacketPayload
{
    public static final Type<CBOpenMessagePayload> TYPE = new Type<>(Starcatcher.rl("open_message"));

    public static final StreamCodec<RegistryFriendlyByteBuf, CBOpenMessagePayload> STREAM_CODEC = StreamCodec.composite(
            Message.STREAM_CODEC, CBOpenMessagePayload::message,
            CBOpenMessagePayload::new
    );

    @Override
    public Type<? extends CustomPacketPayload> type()
    {
        return TYPE;
    }

    public void handle(ClientPlayNetworking.Context context)
    {
        context.client().execute(() -> MessageScreen.openMessageScreen(message));
    }
}
