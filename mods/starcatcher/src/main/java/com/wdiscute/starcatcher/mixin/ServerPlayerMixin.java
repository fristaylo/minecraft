package com.wdiscute.starcatcher.mixin;

import com.wdiscute.starcatcher.messageinabottle.letter.BottledLetterItem;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ServerPlayer.class)
public abstract class ServerPlayerMixin
{
    @Inject(method = "drop(Z)Z", at = @At("HEAD"))
    private void bottledLetterDropped(boolean dropStack, CallbackInfoReturnable<Boolean> cir)
    {
        ServerPlayer player = (ServerPlayer) (Object) this;
        if (player.getInventory().getSelected().getItem() instanceof BottledLetterItem)
            player.displayClientMessage(Component.translatable("item.starcatcher.bottled_letter.dropped"), true);
    }
}
