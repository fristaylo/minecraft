package com.wdiscute.starcatcher.data.network;

import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.registry.SCDataMaps;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;

import java.util.HashMap;
import java.util.Map;

public record CBDataMapsPayload(Map<ResourceLocation, String> json) implements CustomPacketPayload
{
    public static final Type<CBDataMapsPayload> TYPE = new Type<>(Starcatcher.rl("data_maps"));

    public static final StreamCodec<RegistryFriendlyByteBuf, CBDataMapsPayload> STREAM_CODEC = StreamCodec.composite(
            ByteBufCodecs.map(HashMap::new, ResourceLocation.STREAM_CODEC, ByteBufCodecs.stringUtf8(1 << 21)), CBDataMapsPayload::json,
            CBDataMapsPayload::new
    );

    @Override
    public Type<? extends CustomPacketPayload> type()
    {
        return TYPE;
    }

    public void handle(ClientPlayNetworking.Context context)
    {
        context.client().execute(() -> SCDataMaps.applySync(json));
    }
}
