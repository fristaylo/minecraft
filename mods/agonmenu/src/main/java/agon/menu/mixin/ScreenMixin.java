package agon.menu.mixin;

import agon.menu.Panoramas;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.DisconnectedScreen;
import net.minecraft.client.gui.screen.DownloadingTerrainScreen;
import net.minecraft.client.gui.screen.MessageScreen;
import net.minecraft.client.gui.screen.ProgressScreen;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.multiplayer.ConnectScreen;
import net.minecraft.client.gui.screen.world.LevelLoadingScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Screen.class)
public abstract class ScreenMixin {
	@Shadow
	protected MinecraftClient client;
	@Shadow
	public int width;
	@Shadow
	public int height;

	@Shadow
	protected abstract void renderPanoramaBackground(DrawContext context, float delta);

	@Shadow
	protected abstract void applyBlur(float delta);

	@Shadow
	protected abstract void renderDarkening(DrawContext context);

	@Inject(method = "renderPanoramaBackground", at = @At("HEAD"), cancellable = true)
	private void agonmenu$panorama(DrawContext context, float delta, CallbackInfo ci) {
		Panoramas.render(context, width, height, delta);
		ci.cancel();
	}

	@Inject(method = "renderBackground", at = @At("HEAD"), cancellable = true)
	private void agonmenu$loadingBackground(DrawContext context, int mouseX, int mouseY, float delta, CallbackInfo ci) {
		Object self = this;
		if (client.world != null && (self instanceof ConnectScreen || self instanceof LevelLoadingScreen || self instanceof DownloadingTerrainScreen || self instanceof ProgressScreen || self instanceof MessageScreen || self instanceof DisconnectedScreen)) {
			renderPanoramaBackground(context, delta);
			applyBlur(delta);
			renderDarkening(context);
			ci.cancel();
		}
	}
}
