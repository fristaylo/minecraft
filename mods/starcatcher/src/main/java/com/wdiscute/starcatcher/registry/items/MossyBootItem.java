package com.wdiscute.starcatcher.registry.items;

import com.wdiscute.starcatcher.registry.SCItems;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;

public class MossyBootItem extends Item
{
    public MossyBootItem()
    {
        super(new Properties());
    }

    @Override
    public ItemStack getRecipeRemainder(ItemStack itemStack)
    {
        return SCItems.BOOT.toStack();
    }
}
