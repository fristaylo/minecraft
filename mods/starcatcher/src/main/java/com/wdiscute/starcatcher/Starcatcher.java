package com.wdiscute.starcatcher;

import com.mojang.logging.LogUtils;
import com.wdiscute.starcatcher.data.network.SCPayloads;
import com.wdiscute.starcatcher.event.SCEvents;
import com.wdiscute.starcatcher.lib.multiblock.CommonRegistration;
import com.wdiscute.starcatcher.modifiers.Modifier;
import com.wdiscute.starcatcher.registry.fishrestrictions.AbstractFishRestriction;
import com.wdiscute.starcatcher.registry.fishrestrictions.SCFishRestrictions;
import com.wdiscute.starcatcher.registry.tackleskin.AbstractTackleSkin;
import com.wdiscute.starcatcher.registry.tackleskin.SCTackleSkins;
import com.wdiscute.starcatcher.registry.sweetspotbehaviour.SCSweetSpotsBehaviour;
import com.wdiscute.starcatcher.registry.sweetspotbehaviour.AbstractSweetSpotBehaviour;
import com.wdiscute.starcatcher.registry.*;
import com.wdiscute.starcatcher.fish.FishProperties;
import fuzs.forgeconfigapiport.fabric.api.neoforge.v4.NeoForgeConfigRegistry;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.registry.DynamicRegistries;
import net.fabricmc.fabric.api.event.registry.FabricRegistryBuilder;
import net.fabricmc.fabric.api.event.registry.RegistryAttribute;
import net.minecraft.core.Registry;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.stats.StatFormatter;
import net.minecraft.stats.Stats;
import net.neoforged.fml.config.ModConfig;
import org.slf4j.Logger;

import java.util.function.Supplier;

public class Starcatcher implements ModInitializer
{
    public static final String MOD_ID = "starcatcher";
    public static final Logger LOGGER = LogUtils.getLogger();
    public static final ResourceLocation MISSINGNO = rl("missingno");
    public static final ResourceLocation BASE = rl("base");

    //resource keys
    public static final ResourceKey<Registry<FishProperties>> FISH_REGISTRY_KEY =
            ResourceKey.createRegistryKey(Starcatcher.rl("fish"));

    public static final ResourceKey<Registry<AbstractFishRestriction>> FISH_RESTRICTIONS =
            ResourceKey.createRegistryKey(Starcatcher.rl("fish_restrictions"));

    public static final ResourceKey<Registry<Supplier<? extends AbstractSweetSpotBehaviour>>> SWEETSPOT_BEHAVIOUR =
            ResourceKey.createRegistryKey(Starcatcher.rl("sweetspot_behaviour"));

    public static final ResourceKey<Registry<AbstractTackleSkin>> TACKLE_SKIN =
            ResourceKey.createRegistryKey(Starcatcher.rl("bobber_skin"));

    //registry
    public static final Registry<AbstractFishRestriction> FISH_RESTRICTIONS_REGISTRY = FabricRegistryBuilder.createDefaulted(FISH_RESTRICTIONS, Starcatcher.rl("empty"))
            .attribute(RegistryAttribute.SYNCED)
            .buildAndRegister();

    public static final Registry<Supplier<? extends AbstractSweetSpotBehaviour>> SWEETSPOT_BEHAVIOUR_REGISTRY = FabricRegistryBuilder.createDefaulted(SWEETSPOT_BEHAVIOUR, Starcatcher.rl("normal"))
            .attribute(RegistryAttribute.SYNCED)
            .buildAndRegister();

    public static final Registry<AbstractTackleSkin> TACKLE_SKIN_REGISTRY = FabricRegistryBuilder.createDefaulted(TACKLE_SKIN, Starcatcher.BASE)
            .attribute(RegistryAttribute.SYNCED)
            .buildAndRegister();

    public static ResourceLocation rl(String s)
    {
        return ResourceLocation.fromNamespaceAndPath(Starcatcher.MOD_ID, s);
    }

    @Override
    public void onInitialize()
    {
        DynamicRegistries.registerSynced(FISH_REGISTRY_KEY, FishProperties.CODEC);

        SCDataComponents.register();
        SCSounds.register();
        SCPayloads.register();
        CommonRegistration.register();
        SCBlocks.register();
        SCEntities.register();
        SCItems.register();
        SCCreativeModeTabs.register();
        SCBlockEntities.register();
        SCParticles.register();
        SCRecipes.register();
        SCMenuTypes.register();
        SCDataAttachments.register();
        SCSweetSpotsBehaviour.register();
        SCFishRestrictions.register();
        SCTackleSkins.register();
        SCLootModifiers.register();
        SCStats.register();
        Stats.CUSTOM.get(SCStats.TICKS_SPENT_FISHING.get(), StatFormatter.TIME);
        SCAttributes.register();
        SCDataEntries.register();
        SCDataMaps.register();
        SCCriterionTriggers.register();

        SCEvents.register();

        Modifier.registerCatch();
        Modifier.registerMinigame();

        NeoForgeConfigRegistry.INSTANCE.register(MOD_ID, ModConfig.Type.CLIENT, SCConfig.SPEC);
        NeoForgeConfigRegistry.INSTANCE.register(MOD_ID, ModConfig.Type.SERVER, SCConfig.SPEC_SERVER);
    }
}
