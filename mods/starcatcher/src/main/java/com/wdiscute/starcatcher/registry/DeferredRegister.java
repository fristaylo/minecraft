package com.wdiscute.starcatcher.registry;

import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

public class DeferredRegister<T>
{
    private final Registry<T> registry;
    private final String namespace;
    private final Map<DeferredHolder<T, ? extends T>, Supplier<? extends T>> entries = new LinkedHashMap<>();

    protected DeferredRegister(Registry<T> registry, String namespace)
    {
        this.registry = registry;
        this.namespace = namespace;
    }

    public static <T> DeferredRegister<T> create(Registry<T> registry, String namespace)
    {
        return new DeferredRegister<>(registry, namespace);
    }

    public static Items createItems(String namespace)
    {
        return new Items(namespace);
    }

    public static Blocks createBlocks(String namespace)
    {
        return new Blocks(namespace);
    }

    public <I extends T> DeferredHolder<T, I> register(String name, Supplier<? extends I> sup)
    {
        return add(new DeferredHolder<>(registry, id(name)), sup);
    }

    public Collection<DeferredHolder<T, ? extends T>> getEntries()
    {
        return entries.keySet();
    }

    public void register()
    {
        entries.forEach((holder, sup) -> Registry.register(registry, holder.getId(), sup.get()));
    }

    protected <H extends DeferredHolder<T, ? extends T>> H add(H holder, Supplier<? extends T> sup)
    {
        entries.put(holder, sup);
        return holder;
    }

    protected ResourceLocation id(String name)
    {
        return ResourceLocation.fromNamespaceAndPath(namespace, name);
    }

    public static class Items extends DeferredRegister<Item>
    {
        private Items(String namespace)
        {
            super(BuiltInRegistries.ITEM, namespace);
        }

        @Override
        public <I extends Item> DeferredItem<I> register(String name, Supplier<? extends I> sup)
        {
            return add(new DeferredItem<>(BuiltInRegistries.ITEM, id(name)), sup);
        }
    }

    public static class Blocks extends DeferredRegister<Block>
    {
        private Blocks(String namespace)
        {
            super(BuiltInRegistries.BLOCK, namespace);
        }

        @Override
        public <I extends Block> DeferredBlock<I> register(String name, Supplier<? extends I> sup)
        {
            return add(new DeferredBlock<>(BuiltInRegistries.BLOCK, id(name)), sup);
        }
    }
}
