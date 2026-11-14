package agon.menu.mixin;

import agon.menu.AgonTitleScreen;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.world.ClientWorld;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

@Mixin(MinecraftClient.class)
public class MinecraftClientMixin {
	@Shadow
	public ClientWorld world;

	@ModifyVariable(method = "setScreen", at = @At("HEAD"), argsOnly = true)
	private Screen agonmenu$replaceTitleScreen(Screen screen) {
		if (screen == null ? world == null : screen.getClass() == TitleScreen.class) {
			return new AgonTitleScreen();
		}
		return screen;
	}
}
