package ru.pregame.client;

import com.mojang.blaze3d.platform.GlStateManager;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import net.minecraft.util.Util;
import net.minecraft.util.math.MathHelper;
import ru.pregame.network.PhasePayload.Phase;

public class PregameHud {
	private static final Identifier VIGNETTE = Identifier.ofVanilla("textures/misc/vignette.png");
	private static final float MAX_DIM = 0.85F;
	private static final int[] NUMBER_COLORS = {0xFF5555, 0xFFAA00, 0xFFFF55, 0xFFFF55, 0xFFFF55};
	private static final int[] NUMBER_SHADOWS = {0x3F1515, 0x3F2A00, 0x3F3F15, 0x3F3F15, 0x3F3F15};

	private static float vignette;
	private static float blackout;
	private static long lastFrame;

	static void render(DrawContext context, RenderTickCounter tickCounter) {
		MinecraftClient client = MinecraftClient.getInstance();
		long now = Util.getMeasuringTimeMs();
		float ease = Math.min(1F, (now - lastFrame) / 250F);
		lastFrame = now;
		boolean counting = PregameClient.phase == Phase.COUNTDOWN;
		boolean holding = PregameClient.phase == Phase.STARTED && PregameClient.fromCountdown;
		vignette += ((counting ? (6 - PregameClient.seconds) / 5F * MAX_DIM : holding ? MAX_DIM : 0F) - vignette) * ease;
		blackout += ((holding ? 0.7F : 0F) - blackout) * ease;
		if (client.options.hudHidden) {
			return;
		}
		int width = context.getScaledWindowWidth();
		int height = context.getScaledWindowHeight();
		if (vignette > 0.01F) {
			drawVignette(context, width, height);
		}
		if (blackout > 0.01F) {
			context.fill(0, 0, width, height, argb(blackout, 0));
		}
		if ((PregameClient.phase == Phase.WAITING || counting) && PregameClient.inLobby(client)) {
			drawLabel(context, client, width, height, counting, now);
		}
		if (counting) {
			drawCountdown(context, client, width, height, now);
		}
		if (PregameClient.welcomeTime >= 0) {
			drawWelcome(context, client, width, height, now - PregameClient.welcomeTime);
		}
	}

	private static void drawVignette(DrawContext context, int width, int height) {
		context.draw();
		RenderSystem.disableDepthTest();
		RenderSystem.depthMask(false);
		RenderSystem.enableBlend();
		RenderSystem.blendFuncSeparate(GlStateManager.SrcFactor.ZERO, GlStateManager.DstFactor.ONE_MINUS_SRC_COLOR, GlStateManager.SrcFactor.ONE, GlStateManager.DstFactor.ZERO);
		context.setShaderColor(vignette, vignette, vignette, 1F);
		context.drawTexture(VIGNETTE, 0, 0, 0F, 0F, width, height, width, height);
		context.draw();
		RenderSystem.depthMask(true);
		RenderSystem.enableDepthTest();
		context.setShaderColor(1F, 1F, 1F, 1F);
		RenderSystem.defaultBlendFunc();
		RenderSystem.disableBlend();
	}

	private static void drawLabel(DrawContext context, MinecraftClient client, int width, int height, boolean counting, long now) {
		float bob = 1.5F * (1F - MathHelper.cos((now % 3000) / 3000F * MathHelper.TAU));
		float y = height * 0.03F + bob;
		drawText(context, client, Text.translatable(counting ? "pregame.hud.starting" : "pregame.hud.waiting"), width / 2F, y + 8, 2F, 0xFFFF55, 1F, true);
		for (int i = 0; i < 3; i++) {
			boolean bright = counting || ((now - i * 400L) % 1200 + 1200) % 1200 < 400;
			int alpha = bright ? 255 : 64;
			float x = width / 2F - 6 + i * 6;
			context.fill((int) x + 1, (int) y + 21, (int) x + 4, (int) y + 24, alpha << 24 | 0x3F3F15);
			context.fill((int) x, (int) y + 20, (int) x + 3, (int) y + 23, alpha << 24 | 0xFFFF55);
		}
	}

	private static void drawCountdown(DrawContext context, MinecraftClient client, int width, int height, long now) {
		int n = MathHelper.clamp(PregameClient.seconds, 1, 5);
		float t = MathHelper.clamp((now - PregameClient.phaseTime) / 1000F, 0F, 1F);
		float scale = t < 0.18F ? MathHelper.lerp(t / 0.18F, 0.4F, 1.08F)
			: t < 0.3F ? MathHelper.lerp((t - 0.18F) / 0.12F, 1.08F, 1F)
			: MathHelper.lerp((t - 0.3F) / 0.7F, 1F, 1.25F);
		float alpha = t < 0.18F ? t / 0.18F : t < 0.8F ? 1F : (1F - t) / 0.2F;
		float cx = width / 2F;
		float cy = height * 0.44F;
		float size = 9F * scale;
		Text number = Text.literal(String.valueOf(n));
		drawText(context, client, number, cx + size, cy + size, size, NUMBER_SHADOWS[n - 1], alpha, false);
		drawText(context, client, number, cx + size / 2F, cy + size / 2F, size, NUMBER_COLORS[n - 1], alpha, false);
		drawText(context, client, number, cx, cy, size, 0xFFFFFF, alpha, false);
		drawText(context, client, Text.translatable("pregame.hud.countdown"), cx, cy - 50, 1.5F, 0xE0E0E0, 1F, true);
	}

	private static void drawWelcome(DrawContext context, MinecraftClient client, int width, int height, long elapsed) {
		if (elapsed < 1100) {
			context.fill(0, 0, width, height, argb(0.95F * (1F - elapsed / 1100F), 0xFFFFFF));
		}
		float t = elapsed / 2600F;
		if (t >= 1F) {
			PregameClient.welcomeTime = -1;
			return;
		}
		float alpha = t < 0.12F ? t / 0.12F : t < 0.8F ? 1F : (1F - t) / 0.2F;
		float scale = t < 0.12F ? MathHelper.lerp(t / 0.12F, 1.3F, 1F) : 1F;
		float cx = width / 2F;
		float cy = height * 0.4F;
		drawText(context, client, Text.translatable("pregame.hud.started"), cx, cy - 20 * scale, 4F * scale, 0x55FF55, alpha, true);
		drawText(context, client, Text.translatable("pregame.hud.welcome"), cx, cy + 20 * scale, 1.5F * scale, 0xFFFFFF, alpha, true);
	}

	private static void drawText(DrawContext context, MinecraftClient client, Text text, float x, float y, float scale, int rgb, float alpha, boolean shadow) {
		int color = argb(alpha, rgb);
		if ((color >>> 24) < 4) {
			return;
		}
		context.getMatrices().push();
		context.getMatrices().translate(x, y, 0F);
		context.getMatrices().scale(scale, scale, 1F);
		context.drawText(client.textRenderer, text, -client.textRenderer.getWidth(text) / 2, -4, color, shadow);
		context.getMatrices().pop();
	}

	private static int argb(float alpha, int rgb) {
		return (int) (MathHelper.clamp(alpha, 0F, 1F) * 255F) << 24 | rgb;
	}
}
