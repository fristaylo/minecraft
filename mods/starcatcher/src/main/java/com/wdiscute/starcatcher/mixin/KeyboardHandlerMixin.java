package com.wdiscute.starcatcher.mixin;

import com.wdiscute.starcatcher.minigame.KonamiDetector;
import net.minecraft.client.KeyboardHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(KeyboardHandler.class)
public abstract class KeyboardHandlerMixin
{
    @Inject(method = "keyPress", at = @At("TAIL"))
    private void keyPressed(long windowPointer, int key, int scanCode, int action, int modifiers, CallbackInfo ci)
    {
        if (action == 1)
            KonamiDetector.keyPressed(key);
    }
}
