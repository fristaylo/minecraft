package agon.menu;

import com.mojang.blaze3d.systems.RenderSystem;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.LogoDrawer;
import net.minecraft.client.resource.metadata.TextureResourceMetadata;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.ResourceTexture;
import net.minecraft.resource.InputSupplier;
import net.minecraft.resource.ResourceManager;
import net.minecraft.resource.ResourceType;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.MathHelper;

public final class AgonSplash {
	public static final int BACKGROUND = 0xFF0F0D14;
	public static final Identifier LOGO = Identifier.of("agonmenu", "splash_logo");
	private static final int BAR_HEIGHT = 10;
	private static final int BAR_GAP = 28;

	private AgonSplash() {
	}

	public static ResourceTexture createLogoTexture() {
		return new LogoTexture();
	}

	public static void drawLogo(DrawContext context) {
		RenderSystem.defaultBlendFunc();
		context.drawTexture(LOGO, (context.getScaledWindowWidth() - logoWidth(context)) / 2, top(context), logoWidth(context), logoHeight(context), 0, 0, 256, 44, 256, 64);
	}

	public static void drawBar(DrawContext context, float progress, float opacity) {
		int alpha = Math.round(opacity * 255.0F) << 24;
		int width = logoWidth(context);
		int x = (context.getScaledWindowWidth() - width) / 2;
		int y = top(context) + logoHeight(context) + BAR_GAP;
		int fill = x + 1 + MathHelper.ceil((width - 2) * progress);
		context.fill(x, y, x + width, y + BAR_HEIGHT, alpha | 0x111111);
		context.fill(x + 1, y + 1, x + width - 1, y + BAR_HEIGHT - 1, alpha | 0x3A3A3A);
		context.fill(x + 1, y + 1, fill, y + BAR_HEIGHT - 1, alpha | 0x3F8A4E);
		context.fill(x + 1, y + 1, fill, y + 2, alpha | 0x7FD18B);
	}

	private static int top(DrawContext context) {
		return (context.getScaledWindowHeight() - logoHeight(context) - BAR_GAP - BAR_HEIGHT) / 2;
	}

	private static int logoWidth(DrawContext context) {
		return Math.round(256 * scale(context));
	}

	private static int logoHeight(DrawContext context) {
		return Math.round(44 * scale(context));
	}

	private static float scale(DrawContext context) {
		return Math.min(1.5F, Math.max(0.75F, context.getScaledWindowHeight() / 300.0F));
	}

	private static class LogoTexture extends ResourceTexture {
		LogoTexture() {
			super(LOGO);
		}

		@Override
		protected TextureData loadTextureData(ResourceManager resourceManager) {
			InputSupplier<InputStream> supplier = MinecraftClient.getInstance().getDefaultResourcePack().open(ResourceType.CLIENT_RESOURCES, LogoDrawer.LOGO_TEXTURE);
			if (supplier == null) {
				return new TextureData(new FileNotFoundException(LogoDrawer.LOGO_TEXTURE.toString()));
			}
			try (InputStream stream = supplier.get()) {
				return new TextureData(new TextureResourceMetadata(false, false), NativeImage.read(stream));
			} catch (IOException e) {
				return new TextureData(e);
			}
		}
	}
}
