package com.wdiscute.starcatcher.registry;

import net.minecraft.core.Registry;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.ItemLike;
import net.minecraft.world.level.block.Block;

public class DeferredBlock<T extends Block> extends DeferredHolder<Block, T> implements ItemLike
{
    public DeferredBlock(Registry<Block> registry, ResourceLocation id)
    {
        super(registry, id);
    }

    @Override
    public Item asItem()
    {
        return get().asItem();
    }

    public ItemStack toStack()
    {
        return new ItemStack(asItem());
    }
}
