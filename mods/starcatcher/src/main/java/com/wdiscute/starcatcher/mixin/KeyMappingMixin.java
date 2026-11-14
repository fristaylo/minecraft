package com.wdiscute.starcatcher.mixin;

import com.mojang.blaze3d.platform.InputConstants;
import com.wdiscute.starcatcher.registry.SCKeymappings;
import net.minecraft.client.KeyMapping;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.Map;
import java.util.function.Consumer;

@Mixin(KeyMapping.class)
public abstract class KeyMappingMixin
{
    @Redirect(method = "<init>", at = @At(value = "INVOKE", target = "Ljava/util/Map;put(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;", ordinal = 1))
    private Object keepVanillaOnInit(Map<Object, Object> map, Object key, Object value)
    {
        return putKeepingVanilla(map, key, value);
    }

    @Redirect(method = "resetMapping", at = @At(value = "INVOKE", target = "Ljava/util/Map;put(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;"))
    private static Object keepVanillaOnReset(Map<Object, Object> map, Object key, Object value)
    {
        return putKeepingVanilla(map, key, value);
    }

    @Inject(method = "set", at = @At("TAIL"))
    private static void setShared(InputConstants.Key key, boolean pressed, CallbackInfo ci)
    {
        forEachShared(key, mapping -> mapping.setDown(pressed));
    }

    @Inject(method = "click", at = @At("TAIL"))
    private static void clickShared(InputConstants.Key key, CallbackInfo ci)
    {
        forEachShared(key, mapping -> mapping.clickCount++);
    }

    private static Object putKeepingVanilla(Map<Object, Object> map, Object key, Object value)
    {
        return isStarcatcher((KeyMapping) value) ? map.putIfAbsent(key, value) : map.put(key, value);
    }

    private static void forEachShared(InputConstants.Key key, Consumer<KeyMapping> action)
    {
        for (KeyMapping mapping : KeyMapping.ALL.values())
            if (isStarcatcher(mapping) && mapping.key.equals(key) && KeyMapping.MAP.get(key) != mapping)
                action.accept(mapping);
    }

    private static boolean isStarcatcher(KeyMapping mapping)
    {
        return SCKeymappings.CATEGORY.equals(mapping.getCategory());
    }
}
