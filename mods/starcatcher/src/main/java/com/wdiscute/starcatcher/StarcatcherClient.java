package com.wdiscute.starcatcher;

import com.wdiscute.starcatcher.blocks.aquarium.AquariumRenderer;
import com.wdiscute.starcatcher.blocks.display.DisplayBlockRenderer;
import com.wdiscute.starcatcher.blocks.display.DisplayBookModel;
import com.wdiscute.starcatcher.blocks.tacklebox.TackleBoxScreen;
import com.wdiscute.starcatcher.bobentity.FishingBobRenderer;
import com.wdiscute.starcatcher.bobentity.tackles.*;
import com.wdiscute.starcatcher.data.network.SCPayloads;
import com.wdiscute.starcatcher.event.TooltipEvents;
import com.wdiscute.starcatcher.fishentity.FishRenderer;
import com.wdiscute.starcatcher.fishentity.fishmodels.*;
import com.wdiscute.starcatcher.guide.FishingGuideScreen;
import com.wdiscute.starcatcher.lib.multiblock.client.MultiblockPreviewRenderer;
import com.wdiscute.starcatcher.locators.FishRadarLayer;
import com.wdiscute.starcatcher.morajai.MoraJaiScreen;
import com.wdiscute.starcatcher.locators.FishTrackerLayer;
import com.wdiscute.starcatcher.particles.FishingBitingLavaParticles;
import com.wdiscute.starcatcher.particles.FishingBitingParticles;
import com.wdiscute.starcatcher.particles.FishingNotificationParticles;
import com.wdiscute.starcatcher.registry.SCBlockEntities;
import com.wdiscute.starcatcher.registry.SCBlocks;
import com.wdiscute.starcatcher.registry.SCEntities;
import com.wdiscute.starcatcher.registry.SCItemProperties;
import com.wdiscute.starcatcher.registry.SCKeymappings;
import com.wdiscute.starcatcher.registry.SCMenuTypes;
import com.wdiscute.starcatcher.registry.SCParticles;
import com.wdiscute.starcatcher.registry.SCRenderTypes;
import com.wdiscute.starcatcher.registry.items.BucketTooltipRenderer;
import com.wdiscute.starcatcher.registry.items.RodSlotTooltipRenderer;
import com.wdiscute.starcatcher.registry.items.StarcaughtBucket;
import com.wdiscute.starcatcher.registry.items.StarcatcherFishingRodItem;
import com.wdiscute.starcatcher.shaders.BakedModelRemapper;
import com.wdiscute.starcatcher.shaders.GoldRenderer;
import com.wdiscute.starcatcher.tooltips.SCLegendary;
import com.wdiscute.starcatcher.tooltips.SCTooltipGradient;
import com.wdiscute.starcatcher.tooltips.Tooltips;
import com.wdiscute.starcatcher.tournament.StandScreen;
import com.wdiscute.starcatcher.tournament.TournamentOverlay;
import fuzs.forgeconfigapiport.fabric.api.neoforge.v4.client.ConfigScreenFactoryRegistry;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.blockrenderlayer.v1.BlockRenderLayerMap;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.particle.v1.ParticleFactoryRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.BlockEntityRendererRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.CoreShaderRegistrationCallback;
import net.fabricmc.fabric.api.client.rendering.v1.EntityModelLayerRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.EntityRendererRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.fabric.api.client.rendering.v1.TooltipComponentCallback;
import net.fabricmc.fabric.api.resource.ResourceManagerHelper;
import net.fabricmc.fabric.api.resource.SimpleSynchronousResourceReloadListener;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.MenuScreens;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.entity.ThrownItemRenderer;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.packs.PackType;
import net.minecraft.server.packs.resources.ResourceManager;
import net.minecraft.world.entity.Entity;
import net.neoforged.neoforge.client.gui.ConfigurationScreen;
import org.apache.commons.lang3.tuple.Triple;

public class StarcatcherClient implements ClientModInitializer
{
    public static Entity player()
    {
        return Minecraft.getInstance().player;
    }

    public static void openMoraJai()
    {
        Minecraft.getInstance().setScreen(new MoraJaiScreen());
    }

    @Override
    public void onInitializeClient()
    {
        SCPayloads.registerClient();
        MultiblockPreviewRenderer.register();

        TooltipEvents.register();

        registerKeyMappings();
        registerRenderers();
        registerLayers();
        registerBlockRenderLayers();

        MenuScreens.register(SCMenuTypes.STAND_MENU.get(), StandScreen::new);
        MenuScreens.register(SCMenuTypes.TACKLE_BOX.get(), TackleBoxScreen::new);

        ParticleFactoryRegistry.getInstance().register(SCParticles.VALLEY_NOTIFICATION.get(), FishingNotificationParticles.Provider::new);
        ParticleFactoryRegistry.getInstance().register(SCParticles.FISHING_BITING.get(), FishingBitingParticles.Provider::new);
        ParticleFactoryRegistry.getInstance().register(SCParticles.FISHING_BITING_LAVA.get(), FishingBitingLavaParticles.Provider::new);

        TooltipComponentCallback.EVENT.register(data ->
        {
            if (data instanceof StarcaughtBucket.BucketTooltip tooltip) return new BucketTooltipRenderer(tooltip);
            if (data instanceof StarcatcherFishingRodItem.RodSlotTooltip tooltip) return new RodSlotTooltipRenderer(tooltip);
            return null;
        });

        HudRenderCallback.EVENT.register(new FishTrackerLayer()::render);
        HudRenderCallback.EVENT.register(new FishRadarLayer()::render);
        HudRenderCallback.EVENT.register(new TournamentOverlay()::render);

        ResourceManagerHelper.get(PackType.CLIENT_RESOURCES).registerReloadListener(new SimpleSynchronousResourceReloadListener()
        {
            @Override
            public ResourceLocation getFabricId()
            {
                return Starcatcher.rl("gold_renderer");
            }

            @Override
            public void onResourceManagerReload(ResourceManager resourceManager)
            {
                GoldRenderer.INSTANCE.close();
                BakedModelRemapper.REMAPPED_MODELS.clear();
            }
        });

        SCItemProperties.addCustomItemProperties();

        ClientTickEvents.END_CLIENT_TICK.register(client ->
        {
            if (SCKeymappings.EXPAND_TOURNAMENT.consumeClick())
                TournamentOverlay.expandedType = TournamentOverlay.expandedType.next();

            if (SCKeymappings.OPEN_GUIDE.consumeClick() && SCConfig.ALLOW_GUIDE_KEYBIND.get())
                Minecraft.getInstance().setScreen(new FishingGuideScreen(false, null));
        });

        ConfigScreenFactoryRegistry.INSTANCE.register(Starcatcher.MOD_ID, ConfigurationScreen::new);

        CoreShaderRegistrationCallback.EVENT.register(SCRenderTypes::registerShaders);

        //register tooltip tag processors
        Tooltips.registerProcessor("scgolden",
                (t, s, e) -> SCTooltipGradient.process(t,
                        Triple.of(202, 93, 5),
                        Triple.of(230, 204, 9)
                ));

        Tooltips.registerProcessor("sclegendary", SCLegendary::process);

        Tooltips.registerProcessor("scepic",
                (t, s, e) -> SCTooltipGradient.process(t,
                        Triple.of(61, 0, 255),
                        Triple.of(255, 0, 224)
                ));

        Tooltips.registerProcessor("scrare",
                (t, s, e) -> SCTooltipGradient.process(t,
                        Triple.of(20, 40, 120),
                        Triple.of(100, 180, 255)
                ));

        Tooltips.registerProcessor("scuncommon",
                (t, s, e) -> SCTooltipGradient.process(t,
                        Triple.of(11, 185, 2),
                        Triple.of(2, 185, 69)
                ));

        Tooltips.registerProcessor("sccommon",
                (t, s, e) -> Component.literal(t));

        Tooltips.registerProcessor("sctrash",
                (t, s, e) -> Component.literal(t));

        Tooltips.registerProcessor("sclava",
                (t, s, e) -> SCTooltipGradient.process(t,
                        Triple.of(197, 11, 11),
                        Triple.of(197, 64, 11)
                ));

        Tooltips.registerProcessor("scnone",
                (t, s, e) -> Component.literal(t));

        Tooltips.registerProcessor("sclava",
                (t, s, e) -> SCTooltipGradient.process(t,
                        Triple.of(219, 91, 41),
                        Triple.of(219, 129, 41)
                ));
    }

    private static void registerKeyMappings()
    {
        KeyBindingHelper.registerKeyBinding(SCKeymappings.MINIGAME_HIT);
        KeyBindingHelper.registerKeyBinding(SCKeymappings.EXPAND_TOURNAMENT);
        KeyBindingHelper.registerKeyBinding(SCKeymappings.OPEN_GUIDE);
    }

    private static void registerRenderers()
    {
        BlockEntityRendererRegistry.register(SCBlockEntities.DISPLAY.get(), DisplayBlockRenderer::new);
        BlockEntityRendererRegistry.register(SCBlockEntities.AQUARIUM.get(), AquariumRenderer::new);

        EntityRendererRegistry.register(SCEntities.FISHING_BOB.get(), FishingBobRenderer::new);
        EntityRendererRegistry.register(SCEntities.BROKEN_BOTTLE.get(), ThrownItemRenderer::new);
        EntityRendererRegistry.register(SCEntities.BOTTLED_LETTER.get(), ThrownItemRenderer::new);
        EntityRendererRegistry.register(SCEntities.FISH.get(), FishRenderer::new);
    }

    private static void registerBlockRenderLayers()
    {
        BlockRenderLayerMap.INSTANCE.putBlock(SCBlocks.AQUARIUM.get(), RenderType.translucent());

        BlockRenderLayerMap.INSTANCE.putBlocks(RenderType.cutoutMipped(),
                SCBlocks.CLAM.get(),
                SCBlocks.CONCH.get(),
                SCBlocks.TROPHY_OF_THE_OLDER_ANGLER.get(),
                SCBlocks.TROPHY_DIAMOND.get(),
                SCBlocks.TROPHY_EMERALD.get(),
                SCBlocks.TROPHY_GOLD.get(),
                SCBlocks.TROPHY_IRON.get(),
                SCBlocks.TROPHY_COPPER.get());

        BlockRenderLayerMap.INSTANCE.putBlock(SCBlocks.STAND.get(), RenderType.cutout());

        SCBlocks.HATS.getEntries().forEach(hat -> BlockRenderLayerMap.INSTANCE.putBlock(hat.get(), RenderType.cutoutMipped()));
        SCBlocks.TACKLE_BOXES.getEntries().forEach(box -> BlockRenderLayerMap.INSTANCE.putBlock(box.get(), RenderType.cutout()));
    }

    private static void registerLayers()
    {
        //tackle skins
        EntityModelLayerRegistry.registerModelLayer(BaseModel.LAYER_LOCATION, BaseModel::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(ClearModel.LAYER_LOCATION, ClearModel::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(ColorfulModel.LAYER_LOCATION, ColorfulModel::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(FrogModel.LAYER_LOCATION, FrogModel::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(KimbeModel.LAYER_LOCATION, KimbeModel::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(KingModel.LAYER_LOCATION, KingModel::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(PearlModel.LAYER_LOCATION, PearlModel::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(ValleyModel.LAYER_LOCATION, ValleyModel::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(SurvivorModel.LAYER_LOCATION, SurvivorModel::createBodyLayer);

        //book model
        EntityModelLayerRegistry.registerModelLayer(DisplayBookModel.LAYER_LOCATION, DisplayBookModel::createBodyLayer);

        //fishes
        EntityModelLayerRegistry.registerModelLayer(AgaveBream.LAYER_LOCATION, AgaveBream::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(BigeyeTuna.LAYER_LOCATION, BigeyeTuna::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Boreal.LAYER_LOCATION, Boreal::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(CactiFish.LAYER_LOCATION, CactiFish::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Charfish.LAYER_LOCATION, Charfish::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(CrystalbackBoreal.LAYER_LOCATION, CrystalbackBoreal::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(CrystalbackMinnow.LAYER_LOCATION, CrystalbackMinnow::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(DeepjawHerring.LAYER_LOCATION, DeepjawHerring::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(DownfallBream.LAYER_LOCATION, DownfallBream::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Driftfin.LAYER_LOCATION, Driftfin::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(DriftingBream.LAYER_LOCATION, DriftingBream::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(DusktailSnapper.LAYER_LOCATION, DusktailSnapper::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(LilySnapper.LAYER_LOCATION, LilySnapper::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(PinkKoi.LAYER_LOCATION, PinkKoi::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(SilverveilPerch.LAYER_LOCATION, SilverveilPerch::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(SludgeCatfish.LAYER_LOCATION, SludgeCatfish::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Whiteveil.LAYER_LOCATION, Whiteveil::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(WinteryPike.LAYER_LOCATION, WinteryPike::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(CrystalbackTrout.LAYER_LOCATION, CrystalbackTrout::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Embergill.LAYER_LOCATION, Embergill::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(FrostgillChub.LAYER_LOCATION, FrostgillChub::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(FrostjawTrout.LAYER_LOCATION, FrostjawTrout::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(HollowbellyDarter.LAYER_LOCATION, HollowbellyDarter::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(IcetoothSturgeon.LAYER_LOCATION, IcetoothSturgeon::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(MistbackChub.LAYER_LOCATION, MistbackChub::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(BlueCrystalFin.LAYER_LOCATION, BlueCrystalFin::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Carpenjoe.LAYER_LOCATION, Carpenjoe::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Elderscale.LAYER_LOCATION, Elderscale::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(GhostlyPike.LAYER_LOCATION, GhostlyPike::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(IronjarHerring.LAYER_LOCATION, IronjarHerring::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(MirageCarp.LAYER_LOCATION, MirageCarp::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(PetaldriftCarp.LAYER_LOCATION, PetaldriftCarp::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(BlueHerring.LAYER_LOCATION, BlueHerring::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(LightningBass.LAYER_LOCATION, LightningBass::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(LushPike.LAYER_LOCATION, LushPike::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(MagmaFish.LAYER_LOCATION, MagmaFish::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Morganite.LAYER_LOCATION, Morganite::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(PalePinfish.LAYER_LOCATION, PalePinfish::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Pinfish.LAYER_LOCATION, Pinfish::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Pyrotrout.LAYER_LOCATION, Pyrotrout::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Sculkfish.LAYER_LOCATION, Sculkfish::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(SilverfinPike.LAYER_LOCATION, SilverfinPike::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(VividMoss.LAYER_LOCATION, VividMoss::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Willish.LAYER_LOCATION, Willish::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(YellowstoneFish.LAYER_LOCATION, YellowstoneFish::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Voidbiter.LAYER_LOCATION, Voidbiter::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Obidontiee.LAYER_LOCATION, Obidontiee::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(RedscaledTuna.LAYER_LOCATION, RedscaledTuna::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(SunSeekingCarp.LAYER_LOCATION, SunSeekingCarp::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Suneater.LAYER_LOCATION, Suneater::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(SunnySturgeon.LAYER_LOCATION, SunnySturgeon::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(TheQuarrish.LAYER_LOCATION, TheQuarrish::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(ThunderBass.LAYER_LOCATION, ThunderBass::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(TwilightKoi.LAYER_LOCATION, TwilightKoi::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(WillowBream.LAYER_LOCATION, WillowBream::createBodyLayer);
        EntityModelLayerRegistry.registerModelLayer(Cerberay.LAYER_LOCATION, Cerberay::createBodyLayer);
    }
}
