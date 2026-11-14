package com.wdiscute.starcatcher.lib.utils;

import com.mojang.datafixers.util.Either;
import com.mojang.serialization.Codec;
import com.wdiscute.starcatcher.registry.DeferredBlock;
import com.wdiscute.starcatcher.registry.DeferredItem;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.Block;

public record MaybeStack(ResourceLocation rl, ItemStack stack)
{
    public static final MaybeStack EMPTY = new MaybeStack(ItemStack.EMPTY);

    public MaybeStack(ResourceLocation rl)
    {
        this(rl, ItemStack.EMPTY);
    }

    public static MaybeStack of(ResourceLocation rl)
    {
        return BuiltInRegistries.ITEM.getOptional(rl).map(item -> new MaybeStack(item.getDefaultInstance())).orElseGet(() -> new MaybeStack(rl));
    }

    public MaybeStack(String ns, String path)
    {
        this(ResourceLocation.fromNamespaceAndPath(ns, path), ItemStack.EMPTY);
    }

    public MaybeStack(DeferredItem<Item> item)
    {
        this(BuiltInRegistries.ITEM.getKey(item.get()), item.toStack());
    }

    public MaybeStack(DeferredBlock<Block> block)
    {
        this(BuiltInRegistries.ITEM.getKey(block.asItem()), block.toStack());
    }

    public MaybeStack(ItemStack stack)
    {
        this(BuiltInRegistries.ITEM.getKey(stack.getItem()), stack);
    }

    public MaybeStack(Item item)
    {
        this(BuiltInRegistries.ITEM.getKey(item), item.getDefaultInstance());
    }

    public boolean isEmpty()
    {
        return stack.isEmpty();
    }

    public ItemStack toStack()
    {
        if (!isEmpty()) return stack.copy();
        return BuiltInRegistries.ITEM.getOptional(rl)
                .map(ItemStack::new)
                .orElse(ItemStack.EMPTY);
    }

    public Item toItem()
    {
        return toStack().getItem();
    }

    public static final Codec<MaybeStack> CODEC = Codec.either(
            ItemStack.CODEC,
            ResourceLocation.CODEC
    ).xmap(
            either -> either.map(MaybeStack::new, MaybeStack::of),
            maybeStack -> !maybeStack.isEmpty()
                    ? Either.left(maybeStack.toStack())
                    : Either.right(maybeStack.rl())
    );

    public static final StreamCodec<RegistryFriendlyByteBuf, MaybeStack> STREAM_CODEC =
            StreamCodec.composite(
                    ResourceLocation.STREAM_CODEC, MaybeStack::rl,
                    ItemStack.OPTIONAL_STREAM_CODEC, MaybeStack::stack,
                    MaybeStack::new
            );
}
