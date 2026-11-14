package com.wdiscute.starcatcher.mixin;

import com.wdiscute.starcatcher.registry.SCKeymappings;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.gui.screens.options.controls.KeyBindsList;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(KeyBindsList.KeyEntry.class)
public abstract class KeyEntryMixin
{
    @Redirect(method = "refreshEntry", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/KeyMapping;same(Lnet/minecraft/client/KeyMapping;)Z"))
    private boolean ignoreStarcatcherCollision(KeyMapping self, KeyMapping other)
    {
        return self.same(other) && !SCKeymappings.CATEGORY.equals(self.getCategory()) && !SCKeymappings.CATEGORY.equals(other.getCategory());
    }
}
