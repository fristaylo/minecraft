package ru.pregame.client;

import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import ru.pregame.network.StartGamePayload;

public class StartButton extends ButtonWidget {
	private static final Text LABEL = Text.translatable("pregame.button.start");
	private static final int ICON_WIDTH = 6;
	private static final int PADDING = 8;

	private final TextRenderer textRenderer;

	StartButton(MinecraftClient client, int screenWidth) {
		super(0, 8, client.textRenderer.getWidth(LABEL) + ICON_WIDTH + PADDING * 3, 20, LABEL, button -> press(client), DEFAULT_NARRATION_SUPPLIER);
		textRenderer = client.textRenderer;
		setX(screenWidth - 8 - getWidth());
	}

	@Override
	protected void renderWidget(DrawContext context, int mouseX, int mouseY, float delta) {
		int x = getX();
		int y = getY();
		int right = x + getWidth();
		int bottom = y + getHeight();
		context.fill(x, y, right, bottom, isHovered() || isFocused() ? 0xFFFFFFFF : 0xFF000000);
		context.fill(x + 1, y + 1, right - 1, bottom - 1, 0xFF235417);
		context.fill(x + 1, y + 1, right - 2, bottom - 2, 0xFF78C95A);
		context.fill(x + 2, y + 2, right - 2, bottom - 2, 0xFF3F8F2A);
		int iconX = x + PADDING;
		int iconY = y + 5;
		context.fill(iconX, iconY, iconX + 2, iconY + 10, 0xFFFFFFFF);
		context.fill(iconX + 2, iconY + 2, iconX + 4, iconY + 8, 0xFFFFFFFF);
		context.fill(iconX + 4, iconY + 4, iconX + ICON_WIDTH, iconY + 6, 0xFFFFFFFF);
		int textX = iconX + ICON_WIDTH + PADDING;
		int textY = y + 6;
		context.drawText(textRenderer, getMessage(), textX + 1, textY + 1, 0xFF153F15, false);
		context.drawText(textRenderer, getMessage(), textX, textY, 0xFFFFFFFF, false);
	}

	private static void press(MinecraftClient client) {
		if (ClientPlayNetworking.canSend(StartGamePayload.ID)) {
			ClientPlayNetworking.send(new StartGamePayload());
		}
		client.setScreen(null);
	}
}
