package agon.menu.mixin;

import agon.menu.AgonTitleScreen;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(TitleScreen.class)
public abstract class TitleScreenMixin extends Screen {
	protected TitleScreenMixin() {
		super(null);
	}

	@Inject(method = "init", at = @At("HEAD"), cancellable = true)
	private void agonmenu$replace(CallbackInfo ci) {
		if (((Object) this).getClass() == TitleScreen.class) {
			ci.cancel();
			client.setScreen(new AgonTitleScreen());
		}
	}
}
