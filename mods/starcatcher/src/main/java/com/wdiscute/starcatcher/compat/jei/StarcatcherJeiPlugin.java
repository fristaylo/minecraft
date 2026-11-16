package com.wdiscute.starcatcher.compat.jei;

import com.wdiscute.starcatcher.SCTags;
import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.recipe.StarcatcherRodRecipe;
import com.wdiscute.starcatcher.registry.SCBlocks;
import com.wdiscute.starcatcher.registry.SCDataEntries;
import com.wdiscute.starcatcher.registry.SCItems;
import com.wdiscute.starcatcher.lib.utils.Utils;
import mezz.jei.api.IModPlugin;
import mezz.jei.api.gui.builder.IIngredientAcceptor;
import mezz.jei.api.recipe.IFocusFactory;
import mezz.jei.api.recipe.category.extensions.vanilla.smithing.ISmithingCategoryExtension;
import mezz.jei.api.registration.IRecipeCatalystRegistration;
import mezz.jei.api.registration.IRecipeCategoryRegistration;
import mezz.jei.api.registration.IRecipeRegistration;
import mezz.jei.api.registration.IVanillaCategoryExtensionRegistration;
import mezz.jei.api.runtime.IJeiRuntime;
import mezz.jei.api.runtime.IRecipesGui;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.tags.TagKey;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.StreamSupport;

public class StarcatcherJeiPlugin implements IModPlugin
{
    public static List<StarcatcherJeiFPRecipe.Recipe> listRecipes = new ArrayList<>();

    public static IRecipesGui iRecipesGui = null;
    public static IFocusFactory iFocusFactory = null;

    @Override
    public void onRuntimeAvailable(IJeiRuntime jeiRuntime)
    {
        iRecipesGui = jeiRuntime.getRecipesGui();
        iFocusFactory = jeiRuntime.getJeiHelpers().getFocusFactory();
    }

    @Override
    public void registerCategories(IRecipeCategoryRegistration registration)
    {
        listRecipes.clear();

        //add all fps as a recipe to the list
        ClientLevel level = Minecraft.getInstance().level;
        if (level != null)
            level.registryAccess().registry(Starcatcher.FISH_REGISTRY_KEY)
                    .ifPresent(fpRegistry -> fpRegistry.stream().forEach(fp -> listRecipes.add(StarcatcherJeiFPRecipe.Recipe.of(fp))));

        //register categories
        registration.addRecipeCategories(new StarcatcherJeiFPRecipe(registration.getJeiHelpers().getGuiHelper()));
    }

    @Override
    public void registerRecipes(IRecipeRegistration registration)
    {
        //add sellables recipes
        registration.addRecipes(StarcatcherJeiFPRecipe.Recipe.TYPE, listRecipes);

        //worms info
        registration.addItemStackInfo(
                tagStacks(SCTags.WORMS),
                Component.translatable("emi.info.starcatcher.worms.0"),
                Component.translatable("emi.info.starcatcher.worms.1")
        );

        //bonemealing farmland
        List<Utils.Duo<ItemStack, Integer>> drops = SCDataEntries.FARMLAND_BONEMEAL_DROPS.get();
        if (drops != null && !drops.isEmpty())
        {
            List<ItemStack> list = new ArrayList<>(drops.stream().map(Utils.Duo::first).toList());
            list.add(0, Items.BONE_MEAL.getDefaultInstance());
            list.add(0, Items.FARMLAND.getDefaultInstance());
            registration.addItemStackInfo(list,
                    Component.translatable("emi.info.starcatcher.bonemeal_farmland")
            );
        }

        //clams info
        registration.addItemStackInfo(List.of(SCItems.PEARL.get().getDefaultInstance(),
                        SCBlocks.CLAM.get().asItem().getDefaultInstance()),
                Component.translatable("emi.info.starcatcher.pearls.0"),
                Component.translatable("emi.info.starcatcher.pearls.1")
        );

        //hooks, baits, bobbers
        List<ItemStack> attachments = new ArrayList<>();
        attachments.addAll(tagStacks(SCTags.HOOKS));
        attachments.addAll(tagStacks(SCTags.WORMS));
        attachments.addAll(tagStacks(SCTags.BAITS));

        registration.addItemStackInfo(attachments,
                Component.translatable("emi.info.starcatcher.attachments.0"),
                Component.translatable("emi.info.starcatcher.attachments.1")
        );

        //fine bones info
        registration.addItemStackInfo(SCItems.FISH_BONES.get().getDefaultInstance(),
                Component.translatable("emi.info.starcatcher.fish_bones.0")
        );

        //fine bones info
        registration.addItemStackInfo(SCItems.PEARL_SMITHING_TEMPLATE.get().getDefaultInstance(),
                Component.translatable("emi.info.starcatcher.pearl_template.0")
        );

        //fisherman's hat
        SCBlocks.HATS.getEntries().forEach(o ->
        {
            registration.addItemStackInfo(o.get().asItem().getDefaultInstance(),
                    Component.translatable("emi.info.starcatcher.hat.0")
            );
        });
    }

    @Override
    public void registerRecipeCatalysts(IRecipeCatalystRegistration registration)
    {

        registration.addRecipeCatalyst(SCItems.ROD.get(), StarcatcherJeiFPRecipe.Recipe.TYPE);
    }

    @Override
    public void registerVanillaCategoryExtensions(IVanillaCategoryExtensionRegistration registration)
    {
        registration.getSmithingCategory().addExtension(StarcatcherRodRecipe.class, new RodSmithingExtension());
    }

    @Override
    public ResourceLocation getPluginUid()
    {
        return Starcatcher.rl("jei_plugin");
    }

    private static List<ItemStack> tagStacks(TagKey<Item> tag)
    {
        return StreamSupport.stream(BuiltInRegistries.ITEM.getTagOrEmpty(tag).spliterator(), false)
                .map(o -> o.value().getDefaultInstance()).toList();
    }

    private static class RodSmithingExtension implements ISmithingCategoryExtension<StarcatcherRodRecipe>
    {
        @Override
        public <T extends IIngredientAcceptor<T>> void setTemplate(StarcatcherRodRecipe recipe, T ingredientAcceptor)
        {
            ingredientAcceptor.addIngredients(recipe.template());
        }

        @Override
        public <T extends IIngredientAcceptor<T>> void setBase(StarcatcherRodRecipe recipe, T ingredientAcceptor)
        {
            ingredientAcceptor.addIngredients(recipe.rod());
        }

        @Override
        public <T extends IIngredientAcceptor<T>> void setAddition(StarcatcherRodRecipe recipe, T ingredientAcceptor)
        {
            ingredientAcceptor.addIngredients(recipe.material());
        }

        @Override
        public <T extends IIngredientAcceptor<T>> void setOutput(StarcatcherRodRecipe recipe, T ingredientAcceptor)
        {
            if (recipe.keepStack())
                ingredientAcceptor.addIngredients(recipe.rod());
            else
                ingredientAcceptor.addItemStack(recipe.result());
        }
    }
}
