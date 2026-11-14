package com.wdiscute.starcatcher.tooltips;

import com.mojang.serialization.Codec;
import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.StarcatcherClient;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.resources.language.I18n;
import net.minecraft.core.Registry;
import net.minecraft.core.component.DataComponentType;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.network.chat.Style;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.item.ItemStack;
import org.apache.commons.lang3.function.TriFunction;

import javax.annotation.Nullable;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Tooltips
{
    public interface ItemTooltip
    {
        List<String> getAlwaysTooltips(ItemStack stack);

        List<String> getShiftTooltips(ItemStack stack);
    }

    public static final DataComponentType<List<String>> TOOLTIP_ALWAYS = Registry.register(
            BuiltInRegistries.DATA_COMPONENT_TYPE,
            Starcatcher.rl("tooltip_always"),
            DataComponentType.<List<String>>builder().persistent(Codec.STRING.listOf()).build());

    private static final Pattern TAG_PATTERN = Pattern.compile("<([a-zA-Z0-9_]+)>(.*?)</\\1>", Pattern.DOTALL);

    private static final Map<String, TriFunction<String, ItemStack, Entity, MutableComponent>> PROCESSORS = new HashMap<>();

    public static void registerProcessor(String tag, TriFunction<String, ItemStack, Entity, MutableComponent> processor)
    {
        PROCESSORS.put(tag.toLowerCase(), processor);
    }

    public static MutableComponent resolveTagsToComponentFromTranslationKey(String translationKey, @Nullable ItemStack stack, @Nullable Entity entity)
    {
        return resolveTagsToComponent(I18n.get(translationKey), stack, entity);
    }

    public static MutableComponent resolveTagsToComponentFromTranslationKey(String translationKey)
    {
        return resolveTagsToComponent(I18n.get(translationKey), null, null);
    }

    public static MutableComponent resolveTagsToComponent(String input)
    {
        return resolveTagsToComponent(input, null, null);
    }

    public static MutableComponent resolveTagsToComponent(String input, @Nullable ItemStack stack, @Nullable Entity entity)
    {
        MutableComponent result = Component.empty();

        Matcher matcher = TAG_PATTERN.matcher(input);

        int lastEnd = 0;

        while (matcher.find())
        {
            if (matcher.start() > lastEnd)
                result.append(Component.literal(input.substring(lastEnd, matcher.start())));

            var processor = PROCESSORS.get(matcher.group(1).toLowerCase());

            if (processor != null)
                result.append(processor.apply(matcher.group(2), stack, entity));
            else
                result.append(Component.literal(matcher.group()));

            lastEnd = matcher.end();
        }

        if (lastEnd < input.length())
            result.append(Component.literal(input.substring(lastEnd)));

        return result;
    }

    public static void modifyItemTooltip(ItemStack stack, List<Component> tooltipComponents)
    {
        ResourceLocation rl = BuiltInRegistries.ITEM.getKey(stack.getItem());
        String baseTooltip = "tooltip." + rl.getNamespace() + "." + rl.getPath();
        String baseTooltipNoShift = "tooltip.always." + rl.getNamespace() + "." + rl.getPath();

        List<String> always = new ArrayList<>(stack.getOrDefault(TOOLTIP_ALWAYS, List.of()));
        List<String> shift = new ArrayList<>();

        if (stack.getItem() instanceof ItemTooltip it)
        {
            always.addAll(it.getAlwaysTooltips(stack));
            shift.addAll(it.getShiftTooltips(stack));
        }

        if (I18n.exists(baseTooltipNoShift + ".0") || !always.isEmpty())
            addTooltips(tooltipComponents, stack, always, baseTooltipNoShift);

        if (I18n.exists(baseTooltip + ".0") || !shift.isEmpty())
        {
            if (Screen.hasShiftDown())
            {
                tooltipComponents.add(resolveTagsToComponentFromTranslationKey("tooltip.starcatcher.generic.shift_down"));
                addTooltips(tooltipComponents, stack, shift, baseTooltip);
            }
            else
                tooltipComponents.add(resolveTagsToComponentFromTranslationKey("tooltip.starcatcher.generic.shift_up"));
        }
    }

    private static void addTooltips(List<Component> tooltipComponents, ItemStack stack, List<String> keys, String baseKey)
    {
        List<String> allKeys = new ArrayList<>(keys);

        for (int i = 0; i < 100; i++)
        {
            String key = baseKey + "." + i;

            if (!I18n.exists(key) || I18n.get(key).equals("hide"))
                break;

            allKeys.add(key);
        }

        for (String key : allKeys)
            tooltipComponents.add(Component.literal("  ")
                    .append(resolveTagsToComponentFromTranslationKey(key, stack, StarcatcherClient.player()).withStyle(Style.EMPTY.withColor(0x777777))));
    }
}
