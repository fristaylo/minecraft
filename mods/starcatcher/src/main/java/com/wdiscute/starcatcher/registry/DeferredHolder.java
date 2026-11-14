package com.wdiscute.starcatcher.registry;

import com.mojang.datafixers.util.Either;
import net.minecraft.core.Holder;
import net.minecraft.core.HolderOwner;
import net.minecraft.core.Registry;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.tags.TagKey;

import java.util.Optional;
import java.util.function.Predicate;
import java.util.function.Supplier;
import java.util.stream.Stream;

public class DeferredHolder<R, T extends R> implements Holder<R>, Supplier<T>
{
    private final Registry<R> registry;
    private final ResourceKey<R> key;
    private Holder<R> holder;

    public DeferredHolder(Registry<R> registry, ResourceLocation id)
    {
        this.registry = registry;
        this.key = ResourceKey.create(registry.key(), id);
    }

    public ResourceLocation getId()
    {
        return key.location();
    }

    public ResourceKey<R> getKey()
    {
        return key;
    }

    @Override
    public T get()
    {
        return value();
    }

    @Override
    @SuppressWarnings("unchecked")
    public T value()
    {
        return (T) holder().value();
    }

    @Override
    public boolean isBound()
    {
        return holder().isBound();
    }

    @Override
    public boolean is(ResourceLocation id)
    {
        return key.location().equals(id);
    }

    @Override
    public boolean is(ResourceKey<R> key)
    {
        return this.key == key;
    }

    @Override
    public boolean is(Predicate<ResourceKey<R>> predicate)
    {
        return predicate.test(key);
    }

    @Override
    public boolean is(TagKey<R> tag)
    {
        return holder().is(tag);
    }

    @Override
    public boolean is(Holder<R> other)
    {
        return holder().is(other);
    }

    @Override
    public Stream<TagKey<R>> tags()
    {
        return holder().tags();
    }

    @Override
    public Either<ResourceKey<R>, R> unwrap()
    {
        return Either.left(key);
    }

    @Override
    public Optional<ResourceKey<R>> unwrapKey()
    {
        return Optional.of(key);
    }

    @Override
    public Kind kind()
    {
        return Kind.REFERENCE;
    }

    @Override
    public boolean canSerializeIn(HolderOwner<R> owner)
    {
        return holder().canSerializeIn(owner);
    }

    private Holder<R> holder()
    {
        if (holder == null)
            holder = registry.getHolderOrThrow(key);
        return holder;
    }
}
