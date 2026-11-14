package com.wdiscute.starcatcher.registry;

import net.minecraft.core.Registry;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.ItemLike;

public class DeferredItem<T extends Item> extends DeferredHolder<Item, T> implements ItemLike
{
    public DeferredItem(Registry<Item> registry, ResourceLocation id)
    {
        super(registry, id);
    }

    @Override
    public Item asItem()
    {
        return get();
    }

    public ItemStack toStack()
    {
        return new ItemStack(get());
    }
}
