package com.wdiscute.starcatcher.registry;

import com.wdiscute.starcatcher.Starcatcher;
import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;
import net.minecraft.core.Holder;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.ai.attributes.Attribute;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.RangedAttribute;
import net.minecraft.world.entity.player.Player;

public interface SCAttributes
{
    DeferredRegister<Attribute> REGISTRY = DeferredRegister.create(BuiltInRegistries.ATTRIBUTE, Starcatcher.MOD_ID);

    Holder<Attribute> HANDLE_ROTATION_SPEED_MULTIPLIER = register("handle_rotation_speed_multiplier", 1, 0, 10);
    Holder<Attribute> PENALTY_MULTIPLIER = registerNegative("penalty_multiplier", 1, 0, 10);
    Holder<Attribute> BASE_DECAY_MULTIPLIER = registerNegative("base_decay_multiplier", 1, 0, 10);
    Holder<Attribute> REQUIRED_SCORE_MULTIPLIER = register("required_score_multiplier", 1, 0, 10);
    Holder<Attribute> VANISHING_RATE_MULTIPLIER = register("vanishing_rate_multiplier", 1, 0, 10);

    private static Holder<Attribute> register(String name, double defaultVal, double min, double max)
    {
        return REGISTRY.register(name, () -> new RangedAttribute(name, defaultVal, min, max).setSyncable(true));
    }

    private static Holder<Attribute> registerNegative(String name, double defaultVal, double min, double max)
    {
        return REGISTRY.register(name, () -> new RangedAttribute(name, defaultVal, min, max).setSyncable(true).setSentiment(Attribute.Sentiment.NEGATIVE));
    }

    static void register()
    {
        REGISTRY.register();

        AttributeSupplier.Builder playerAttributes = Player.createAttributes();
        REGISTRY.getEntries().forEach(o -> playerAttributes.add(o, 1.0));
        FabricDefaultAttributeRegistry.register(EntityType.PLAYER, playerAttributes);
    }
}
