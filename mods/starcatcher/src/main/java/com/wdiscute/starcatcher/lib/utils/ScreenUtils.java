package com.wdiscute.starcatcher.lib.utils;

import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.vertex.PoseStack;
import com.wdiscute.starcatcher.lib.utils.compat.JeiCompat;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.util.FormattedCharSequence;
import net.minecraft.world.item.ItemStack;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class ScreenUtils
{
    public static class Tooltip
    {
        private static List<Component> tooltip = null;
        private static ItemStack stack = null;

        public static void set(ItemStack stack)
        {
            Tooltip.stack = stack;
        }

        public static void set(List<Component> list)
        {
            tooltip = new ArrayList<>(list);
        }

        public static void add(Component component)
        {
            if (tooltip == null)
                tooltip = new ArrayList<>();
            tooltip.add(component);
        }

        public static void add(int index, Component component)
        {
            if (tooltip == null)
                tooltip = new ArrayList<>();
            tooltip.add(Math.clamp(index, 0, tooltip.size()), component);
        }

        public static void render(GuiGraphics guiGraphics, Font font, int x, int y)
        {
            if (stack != null)
                guiGraphics.renderTooltip(font, stack, x, y);

            if (tooltip != null)
                guiGraphics.renderTooltip(font, tooltip, Optional.empty(), x, y);

            tooltip = null;
            stack = null;
        }
    }

    private static int color = -1;

    public static void setColor(int color)
    {
        ScreenUtils.color = color;
    }

    public static void resetColor()
    {
        ScreenUtils.color = -1;
        RenderSystem.setShaderColor(1, 1, 1, 1);
        RenderSystem.disableBlend();
    }

    private static void setColorInternal()
    {
        RenderSystem.enableBlend();
        RenderSystem.setShaderColor(
                ((color >> 16) & 0xFF) / 255.0f,
                ((color >> 8) & 0xFF) / 255.0f,
                (color & 0xFF) / 255.0f,
                ((color >> 24) & 0xFF) / 255.0f
        );
    }

    public record Image(ResourceLocation rl, int textureWidth, int textureHeight)
    {
        public void render(GuiGraphics guiGraphics)
        {
            render(guiGraphics, 0, 0);
        }

        public void render(GuiGraphics guiGraphics, int x, int y)
        {
            if (color != -1) setColorInternal();

            guiGraphics.blit(rl,
                    x, y,
                    textureWidth, textureHeight,
                    0, 0,
                    textureWidth, textureHeight,
                    textureWidth, textureHeight
            );

            resetColor();
        }

        public void render(GuiGraphics guiGraphics, int x, int y, float scale)
        {
            if (color != -1) setColorInternal();

            guiGraphics.blit(rl,
                    x, y,
                    (int) (textureWidth * scale), (int) (textureHeight * scale),
                    0, 0,
                    textureWidth, textureHeight,
                    textureWidth, textureHeight
            );

            resetColor();
        }
    }

    public static void item(GuiGraphics guiGraphics, ItemStack itemStack, int x, int y)
    {
        guiGraphics.renderItem(itemStack, x, y);
    }

    public static void item(GuiGraphics guiGraphics, ItemStack itemStack, int x, int y, PoseStack poseStack, float scale)
    {
        poseStack.pushPose();
        poseStack.translate(x - 8, y - 8, 0);
        poseStack.scale(scale, scale, 1);
        guiGraphics.renderItem(itemStack, 0, 0);
        poseStack.popPose();
    }

    public static void text(GuiGraphics guiGraphics, Font font, Component text, int x, int y, int color, boolean shadow)
    {
        guiGraphics.drawString(font, text, x, y, color, shadow);
    }

    public static void text(GuiGraphics guiGraphics, Font font, String text, int x, int y, int color, boolean shadow)
    {
        guiGraphics.drawString(font, text, x, y, color, shadow);
    }

    public static void text(GuiGraphics guiGraphics, Font font, String text, int x, int y, int color)
    {
        guiGraphics.drawString(font, text, x, y, color, true);
    }

    public static void centeredText(GuiGraphics guiGraphics, Font font, Component text, int x, int y, int color, boolean shadow)
    {
        FormattedCharSequence formattedcharsequence = text.getVisualOrderText();
        guiGraphics.drawString(font, formattedcharsequence, x - font.width(formattedcharsequence) / 2, y, color, shadow);
    }

    public static void centeredText(GuiGraphics guiGraphics, Font font, String text, int x, int y, int color, boolean shadow)
    {
        FormattedCharSequence formattedcharsequence = Component.literal(text).getVisualOrderText();
        guiGraphics.drawString(font, formattedcharsequence, x - font.width(formattedcharsequence) / 2, y, color, shadow);
    }

    public static void outline(GuiGraphics guiGraphics, int x, int y, int sizeX, int sizeY, int color)
    {
        guiGraphics.renderOutline(x, y, sizeX, sizeY, color);
    }

    public static void fill(GuiGraphics guiGraphics, int x, int y, int sizeX, int sizeY, int color)
    {
        guiGraphics.fill(x, y, x + sizeX, y + sizeY, color);
    }

    public static void displayRecipe(ItemStack stack)
    {
        if (FabricLoader.getInstance().isModLoaded("jei"))
            JeiCompat.displayRecipes(stack);
    }
}
