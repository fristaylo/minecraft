package com.wdiscute.starcatcher.registry;

import com.wdiscute.starcatcher.SCTags;
import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.fish.FishApi;
import com.wdiscute.starcatcher.fish.FishProperties;
import com.wdiscute.starcatcher.modifiers.catchmodifiers.AdjustLureTimeModifier;
import com.wdiscute.starcatcher.modifiers.catchmodifiers.ExtraGoldenChanceModifier;
import com.wdiscute.starcatcher.modifiers.minigamemodifiers.NeverLoseModifier;
import net.fabricmc.fabric.api.itemgroup.v1.FabricItemGroup;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.tags.TagKey;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ItemStackLinkedSet;

import java.util.List;
import java.util.Set;


public interface SCCreativeModeTabs
{
    static void register()
    {
        Registry.register(BuiltInRegistries.CREATIVE_MODE_TAB, Starcatcher.rl("starcatcher"), FabricItemGroup.builder()
                .title(Component.translatable("itemGroup.starcatcher.starcatcher"))
                .icon(SCItems.ROD::toStack)
                .displayItems((parameters, rawOutput) ->
                {
                    CreativeModeTab.Output output = deduplicating(rawOutput);

                    //Must Have
                    output.accept(SCItems.ROD);

                    ItemStack icebornDevRod = SCItems.ICEBORN_ROD.toStack();
                    SCDataComponents.set(icebornDevRod, SCDataComponents.MODIFIERS, List.of(
                            new NeverLoseModifier(""),
                            new AdjustLureTimeModifier(0.05f, 0.05f, 1f, "")
                    ));
                    output.accept(icebornDevRod);

                    ItemStack obsidianDevRod = SCItems.OBSIDIAN_ROD.toStack();
                    SCDataComponents.set(obsidianDevRod, SCDataComponents.MODIFIERS, List.of(
                            new ExtraGoldenChanceModifier(1, false, ""),
                            new AdjustLureTimeModifier(0.05f, 0.05f, 1f, "")
                    ));
                    output.accept(obsidianDevRod);

                    output.accept(SCItems.GUIDE);
                    output.accept(SCBlocks.STAND);
                    output.accept(SCBlocks.DISPLAY);
                    output.accept(SCBlocks.TACKLE_BOX);
                    output.accept(SCBlocks.AQUARIUM);

                    //hooks & bobbers
                    acceptTag(output, SCTags.HOOKS);
                    acceptTag(output, SCTags.BOBBERS);
                    acceptTag(output, SCTags.BAITS);

                    //cosmetics
                    SCItems.RODS_REGISTRY.getEntries().forEach(o -> output.accept(o.get()));
                    SCItems.TEMPLATES_REGISTRY.getEntries().forEach(o -> output.accept(o.get()));
                    SCBlocks.HATS.getEntries().forEach(o -> output.accept(o.get()));

                    //tackle boxes
                    SCBlocks.TACKLE_BOXES.getEntries().forEach(o -> output.accept(o.get()));

                    //Trophies & Secrets
                    output.accept(SCBlocks.TROPHY_COPPER);
                    output.accept(SCBlocks.TROPHY_IRON);
                    output.accept(SCBlocks.TROPHY_GOLD);
                    output.accept(SCBlocks.TROPHY_EMERALD);
                    output.accept(SCBlocks.TROPHY_DIAMOND);
                    output.accept(SCBlocks.TROPHY_OF_THE_OLDER_ANGLER);

                    output.accept(SCItems.LETTER);
                    output.accept(SCItems.BOTTLED_LETTER);
                    output.accept(SCItems.MESSAGE_IN_A_BOTTLE);
                    output.accept(SCItems.BROKEN_BOTTLE);
                    output.accept(SCItems.MESSAGE);

                    //secret messages
                    for (FishProperties fp : FishApi.getMessages(parameters.holders()))
                    {
                        ItemStack stack = fp.catchInfo().fish().toStack();

                        if (stack.has(SCDataComponents.MESSAGE.get()))
                        {
                            SCDataComponents.set(stack, SCDataComponents.MESSAGE, stack.get(SCDataComponents.MESSAGE.get()));
                            output.accept(stack);
                        }
                    }

                    //Fish
                    SCItems.BUCKETABLE_FISHES_REGISTRY.getEntries().forEach(o -> output.accept(o.get()));
                    SCItems.NON_BUCKETABLE_FISH_REGISTRY.getEntries().forEach(o -> output.accept(o.get()));
                    SCItems.NON_FISH_FISH_REGISTRY.getEntries().forEach(o -> output.accept(o.get()));
                    output.accept(SCItems.LAVA_CRAB_CLAW);
                    output.accept(SCBlocks.CLAM);
                    output.accept(SCBlocks.CONCH);

                    //Miscellaneous
                    output.accept(SCItems.BOOT);
                    output.accept(SCItems.MOSSY_BOOT);
                    output.accept(SCItems.DRIED_SEAWEED);

                    output.accept(SCItems.FISH_BONES);

                    output.accept(SCItems.FISH_RADAR);
                    output.accept(SCItems.PEARL);
                    output.accept(SCItems.STARCATCHER_TWINE);
                    output.accept(SCItems.MISSINGNO);
                    output.accept(SCItems.UNKNOWN_FISH);
                    output.accept(SCItems.STARCAUGHT_BUCKET);
                    output.accept(SCItems.STARCAUGHT_LAVA_BUCKET);
                    output.accept(SCItems.STARCAUGHT_FISH);
                    output.accept(SCItems.COOKED_STARCAUGHT_FISH);
                })
                .build());
    }

    private static void acceptTag(CreativeModeTab.Output output, TagKey<Item> tag)
    {
        BuiltInRegistries.ITEM.getTagOrEmpty(tag).forEach(o -> output.accept(o.value()));
    }

    private static CreativeModeTab.Output deduplicating(CreativeModeTab.Output delegate)
    {
        Set<ItemStack> added = ItemStackLinkedSet.createTypeAndComponentsSet();
        return (stack, visibility) ->
        {
            if (added.add(stack.copy())) delegate.accept(stack, visibility);
        };
    }
}
