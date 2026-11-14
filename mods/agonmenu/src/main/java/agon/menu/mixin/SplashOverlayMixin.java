package agon.menu.mixin;

import agon.menu.AgonSplash;
import java.util.function.IntSupplier;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.SplashOverlay;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(SplashOverlay.class)
public class SplashOverlayMixin {
	@Shadow
	private float progress;

	@Inject(method = "init", at = @At("TAIL"))
	private static void agonmenu$registerLogo(MinecraftClient client, CallbackInfo ci) {
		client.getTextureManager().registerTexture(AgonSplash.LOGO, AgonSplash.createLogoTexture());
	}

	@Redirect(method = "render", at = @At(value = "INVOKE", target = "Ljava/util/function/IntSupplier;getAsInt()I"))
	private int agonmenu$background(IntSupplier brand) {
		return AgonSplash.BACKGROUND;
	}

	@Redirect(method = "render", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/gui/DrawContext;drawTexture(Lnet/minecraft/util/Identifier;IIIIFFIIII)V", ordinal = 0))
	private void agonmenu$logo(DrawContext context, Identifier texture, int x, int y, int width, int height, float u, float v, int regionWidth, int regionHeight, int textureWidth, int textureHeight) {
		AgonSplash.drawLogo(context);
	}

	@Redirect(method = "render", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/gui/DrawContext;drawTexture(Lnet/minecraft/util/Identifier;IIIIFFIIII)V", ordinal = 1))
	private void agonmenu$skipLogoHalf(DrawContext context, Identifier texture, int x, int y, int width, int height, float u, float v, int regionWidth, int regionHeight, int textureWidth, int textureHeight) {
	}

	@Inject(method = "renderProgressBar", at = @At("HEAD"), cancellable = true)
	private void agonmenu$bar(DrawContext context, int minX, int minY, int maxX, int maxY, float opacity, CallbackInfo ci) {
		AgonSplash.drawBar(context, progress, opacity);
		ci.cancel();
	}
}
