package com.wdiscute.starcatcher.modifiers.catchmodifiers;

import com.mojang.serialization.Codec;
import com.mojang.serialization.MapCodec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.modifiers.Modifier;
import net.minecraft.resources.ResourceLocation;

public class AnglersHatModifier extends AbstractCatchModifier
{
    public static final MapCodec<AnglersHatModifier> CODEC = RecordCodecBuilder.mapCodec(instance ->
            instance.group(
                    Codec.STRING.optionalFieldOf("translation_override", "").forGetter(o -> o.translationOverride)
            ).apply(instance, AnglersHatModifier::new));

    public AnglersHatModifier(String translationOverrider)
    {
        super(translationOverrider);
    }

    @Override
    public ResourceLocation getIdentifier()
    {
        return Starcatcher.rl("anglers_hat");
    }

    @Override
    public MapCodec<? extends Modifier> getCodec()
    {
        return CODEC;
    }
}
