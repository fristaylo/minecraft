package com.wdiscute.starcatcher.registry;

import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.recipe.*;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.item.crafting.RecipeSerializer;

import java.util.function.Supplier;

public interface SCRecipes
{
    DeferredRegister<RecipeSerializer<?>> REGISTRY =
            DeferredRegister.create(BuiltInRegistries.RECIPE_SERIALIZER, Starcatcher.MOD_ID);

     Supplier<RecipeSerializer<StarcatcherRodRecipe>> FISHING_ROD_SMITHING =
            REGISTRY.register("starcatcher_rod_smithing_recipe", StarcatcherRodRecipe.Serializer::new);

     Supplier<RecipeSerializer<BottledLetterRecipe>> BOTTLED_LETTER =
            REGISTRY.register("bottled_letter", BottledLetterRecipe.Serializer::new);

    static void register()
    {
        REGISTRY.register();
    }
}
