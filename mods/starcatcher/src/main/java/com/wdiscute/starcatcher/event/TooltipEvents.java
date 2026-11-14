package com.wdiscute.starcatcher.event;

import com.wdiscute.starcatcher.tooltips.Tooltips;
import com.wdiscute.starcatcher.SCColors;
import com.wdiscute.starcatcher.SCConfig;
import com.wdiscute.starcatcher.SCTags;
import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.fish.SizeAndWeight;
import com.wdiscute.starcatcher.data.CaughtFishInfo;
import com.wdiscute.starcatcher.messageinabottle.letter.EditableMessage;
import com.wdiscute.starcatcher.messageinabottle.message.Message;
import com.wdiscute.starcatcher.modifiers.Modifier;
import com.wdiscute.starcatcher.registry.SCDataComponents;
import com.wdiscute.starcatcher.registry.SCDataMaps;
import com.wdiscute.starcatcher.registry.SCItems;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.resources.language.I18n;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.network.chat.Style;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.item.Item;
import net.fabricmc.fabric.api.client.item.v1.ItemTooltipCallback;

import java.util.ArrayList;
import java.util.List;

public class TooltipEvents
{

    static int cachedTimer = 0;
    static ItemStack cachedItem = ItemStack.EMPTY;
    static List<Component> cachedComps = List.of();
    static boolean cachedShift = false;

    public static void register()
    {
        ItemTooltipCallback.EVENT.register((stack, context, flag, lines) -> Tooltips.modifyItemTooltip(stack, lines));
        ItemTooltipCallback.EVENT.register(TooltipEvents::tooltipEvent);
    }

    public static void tooltipEvent(ItemStack stack, Item.TooltipContext context, TooltipFlag flag, List<Component> toolTip)
    {
        List<Component> comp = new ArrayList<>();
        boolean hasShiftDown = Screen.hasShiftDown();

        //cache check
        if (stack == cachedItem && cachedTimer > 0 && hasShiftDown == cachedShift)
        {
            cachedTimer--;
            if (!toolTip.isEmpty())
                toolTip.addAll(1, cachedComps);
            else
                toolTip.addAll(cachedComps);
            return;
        }

        cachedTimer = 100;
        cachedShift = hasShiftDown;
        cachedItem = stack;

        //Netherite Upgrade
        if (SCDataComponents.has(stack, SCDataComponents.NETHERITE_UPGRADE))
        {
            if (Boolean.TRUE.equals(SCDataComponents.get(stack, SCDataComponents.NETHERITE_UPGRADE)))
            {
                comp.add(Tooltips.resolveTagsToComponentFromTranslationKey("tooltip.starcatcher.rod.netherite"));
            }
        }

        //tackle skin data component
        ResourceLocation tackleSkinDC = Starcatcher.TACKLE_SKIN_REGISTRY.getKey(
                SCDataComponents.getOrDefault(stack, SCDataComponents.TACKLE_SKIN, Starcatcher.TACKLE_SKIN_REGISTRY.get(Starcatcher.BASE)));
        if (tackleSkinDC != null && !tackleSkinDC.equals(Starcatcher.BASE))
        {
            String s = I18n.get("tooltip.tackle." + tackleSkinDC.toLanguageKey());
            if (!s.isEmpty())
            {
                comp.add(Tooltips.resolveTagsToComponentFromTranslationKey("tooltip.starcatcher.tackle").withStyle(ChatFormatting.GRAY));
                comp.add(Component.literal(" -").append(Component.literal(s))
                        .withStyle(Style.EMPTY.withColor(SCColors.TOOLTIP_GRAY)));
            }
        }

        //tackle skin data map
        ResourceLocation tackleSkinDM = Starcatcher.TACKLE_SKIN_REGISTRY.getKey(
                SCDataMaps.getOrDefault(stack, SCDataMaps.TACKLE_SKIN, Starcatcher.TACKLE_SKIN_REGISTRY.get(Starcatcher.BASE)));
        if (tackleSkinDM != null && !tackleSkinDM.equals(Starcatcher.BASE))
        {
            String s = I18n.get("tooltip.tackle." + tackleSkinDM.toLanguageKey());
            if (!s.isEmpty())
            {
                comp.add(Tooltips.resolveTagsToComponentFromTranslationKey("tooltip.starcatcher.tackle").withStyle(ChatFormatting.GRAY));
                comp.add(Component.literal(" -").append(Component.literal(s))
                        .withStyle(Style.EMPTY.withColor(SCColors.TOOLTIP_GRAY)));
            }
        }

        //caught fish info
        if (SCDataComponents.has(stack, SCDataComponents.CAUGHT_FISH_INFO))
        {
            SizeAndWeight.Units units = SCConfig.UNIT.get();
            CaughtFishInfo caughtFishInfo = SCDataComponents.get(stack, SCDataComponents.CAUGHT_FISH_INFO);

            if (caughtFishInfo.golden())
            {
                cachedTimer = -1;
                MutableComponent element = Component.empty().append(Tooltips.resolveTagsToComponentFromTranslationKey("gui.guide.rarity.golden")).withStyle(Style.EMPTY.withColor(0x888888));
                if (hasShiftDown)
                    element.append(Component.literal(" (top 0%)").withStyle(Style.EMPTY.withColor(0x707070)));
                comp.add(element);
            }
            else
            {
                String size = units.getSizeAsString(caughtFishInfo.size());
                String weight = units.getWeightAsString(caughtFishInfo.weight());
                String percentile = " (top " + (int) caughtFishInfo.percentile() + "%)";

                MutableComponent element = Component.literal(size + " - " + weight).withStyle(Style.EMPTY.withColor(0x888888));
                if (hasShiftDown)
                    element.append(Component.literal(percentile).withStyle(Style.EMPTY.withColor(0x707070)));
                comp.add(element);
            }
        }

        //message tooltip
        if (SCDataComponents.has(stack, SCDataComponents.MESSAGE) && stack.is(SCItems.MESSAGE.get()))
        {
            Message message = SCDataComponents.get(stack, SCDataComponents.MESSAGE);
            if (!message.senderDisplayName().isEmpty())
            {
                if (hasShiftDown)
                    comp.add(Component.translatable("tooltip.starcatcher.letter", message.sender().toString()).withStyle(ChatFormatting.GRAY));
                else
                    comp.add(Component.translatable("tooltip.starcatcher.letter").withStyle(ChatFormatting.GRAY).append(Component.translatable(message.senderDisplayName())).withStyle(ChatFormatting.GRAY));
            }
        }

        //letters tooltip
        if (SCDataComponents.has(stack, SCDataComponents.EDITABLE_MESSAGE))
        {
            EditableMessage message = SCDataComponents.get(stack, SCDataComponents.EDITABLE_MESSAGE);
            if (!message.sender().isEmpty())
            {
                if (hasShiftDown)
                    comp.add(Component.translatable("tooltip.starcatcher.letter", message.sender()).withStyle(ChatFormatting.GRAY));
                else
                    comp.add(Component.translatable("tooltip.starcatcher.letter", message.sender()).withStyle(ChatFormatting.GRAY));
            }
        }

        //modifiers
        Player player = Minecraft.getInstance().player;
        List<Modifier> modifiers;

        //if rod, get every modifier not just the itemstack
        if (stack.is(SCTags.RODS) && player != null && (stack == player.getItemInHand(InteractionHand.MAIN_HAND) || stack == player.getItemInHand(InteractionHand.OFF_HAND)))
            modifiers = Modifier.getModifiers(player);
        else
            modifiers = Modifier.getModifiers(stack);

        if (!modifiers.isEmpty())
        {
            List<Component> modComp = new ArrayList<>();

            //add modifiers
            if (player != null)
            {
                //add catch modifiers
                modifiers.forEach(o ->
                        o.getDescription(hasShiftDown).forEach(
                                c ->
                                {
                                    if (!c.getString().equals("hide") && !c.getString().isEmpty())
                                        modComp.add(Component.literal(" -").append(c)
                                                .withStyle(Style.EMPTY.withColor(SCColors.TOOLTIP_GRAY)));
                                })
                );

                if (!modComp.isEmpty())
                    //if it's the active rod, add active modifiers, otherwise fishing modifiers
                    if (stack.is(SCTags.RODS) && (stack == player.getItemInHand(InteractionHand.MAIN_HAND) || stack == player.getItemInHand(InteractionHand.OFF_HAND)))
                    {
                        cachedTimer = -1;
                        comp.add(Tooltips.resolveTagsToComponentFromTranslationKey("tooltip.starcatcher.modifiers.active").withStyle(ChatFormatting.GRAY));
                    }
                    else
                        comp.add(Tooltips.resolveTagsToComponentFromTranslationKey("tooltip.starcatcher.modifiers").withStyle(ChatFormatting.GRAY));

                comp.addAll(modComp);
            }
        }

        cachedComps = comp;
        if (!toolTip.isEmpty())
            toolTip.addAll(1, comp);
        else
            toolTip.addAll(comp);
    }
}
