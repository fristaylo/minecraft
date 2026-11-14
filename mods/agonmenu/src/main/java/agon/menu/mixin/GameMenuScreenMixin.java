package agon.menu.mixin;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.GameMenuScreen;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(GameMenuScreen.class)
public class GameMenuScreenMixin {
	@Shadow
	@Final
	private boolean showMenu;

	@Inject(method = "renderBackground", at = @At("TAIL"))
	private void agonmenu$tint(DrawContext context, int mouseX, int mouseY, float delta, CallbackInfo ci) {
		if (showMenu) {
			context.fill(0, 0, context.getScaledWindowWidth(), context.getScaledWindowHeight(), 0x400F0D14);
		}
	}
}
