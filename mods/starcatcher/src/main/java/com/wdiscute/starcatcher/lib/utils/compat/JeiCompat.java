package com.wdiscute.starcatcher.lib.utils.compat;

import com.wdiscute.starcatcher.compat.jei.StarcatcherJeiPlugin;
import mezz.jei.api.constants.VanillaTypes;
import mezz.jei.api.recipe.IFocus;
import mezz.jei.api.recipe.RecipeIngredientRole;
import net.minecraft.world.item.ItemStack;

public class JeiCompat
{
    public static void displayRecipes(ItemStack is)
    {
        IFocus<ItemStack> focus = StarcatcherJeiPlugin.iFocusFactory.createFocus(RecipeIngredientRole.OUTPUT, VanillaTypes.ITEM_STACK, is);
        StarcatcherJeiPlugin.iRecipesGui.show(focus);
    }
}
