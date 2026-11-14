package agon.menu;

import com.mojang.blaze3d.systems.RenderSystem;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.LogoDrawer;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.multiplayer.ConnectScreen;
import net.minecraft.client.gui.screen.option.LanguageOptionsScreen;
import net.minecraft.client.gui.screen.option.OptionsScreen;
import net.minecraft.client.gui.tooltip.Tooltip;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.network.MultiplayerServerListPinger;
import net.minecraft.client.network.ServerAddress;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.text.Text;
import net.minecraft.text.TranslatableTextContent;
import net.minecraft.util.Identifier;
import net.minecraft.util.Util;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class AgonTitleScreen extends Screen {
	private static final Logger LOGGER = LoggerFactory.getLogger("agonmenu");
	private static final String ADDRESS = Optional.ofNullable(System.getProperty("agon.server"))
		.map(String::trim)
		.filter(address -> !address.isEmpty())
		.orElse(null);
	private static final Identifier JOIN = Identifier.of("agonmenu", "widget/join");
	private static final Identifier JOIN_HIGHLIGHTED = Identifier.of("agonmenu", "widget/join_highlighted");
	private static final int REPING_TICKS = 600;
	private static final int COLOR_ONLINE = 0xFF4CD964;
	private static final int COLOR_OFFLINE = 0xFFE5453B;
	private static final int COLOR_CHECKING = 0xFFA0A0A0;

	private final MultiplayerServerListPinger pinger = new MultiplayerServerListPinger();
	private volatile Text statusText = Text.literal("Проверка сервера…");
	private volatile int statusColor = COLOR_CHECKING;
	private volatile boolean pinging;
	private ServerInfo pingInfo;
	private int ticks;
	private int logoX;
	private int logoY;
	private int logoWidth;
	private int logoHeight;
	private int statusY;

	public AgonTitleScreen() {
		super(Text.literal("Agon Menu"));
	}

	@Override
	protected void init() {
		float scale = Math.min(1.5F, Math.max(0.75F, height / 300.0F));
		logoWidth = Math.round(256 * scale);
		logoHeight = Math.round(44 * scale);
		logoX = (width - logoWidth) / 2;
		int center = width / 2;
		int total = logoHeight + 16 + (ADDRESS != null ? 15 : 0) + 24 + 4 + 20 + 18 + 20;
		int y = logoY = Math.max(8, (height - total) / 2);
		y += logoHeight + 16;
		if (ADDRESS != null) {
			statusY = y;
			y += 15;
		}
		JoinButton joinButton = new JoinButton(center - 100, y, Text.literal("Подключиться к серверу"), button -> join());
		joinButton.active = ADDRESS != null;
		addDrawableChild(joinButton);
		y += 28;
		addDrawableChild(ButtonWidget.builder(Text.literal("Настройки"), button -> client.setScreen(new OptionsScreen(this, client.options)))
			.dimensions(center - 100, y, 98, 20)
			.build());
		addDrawableChild(ButtonWidget.builder(Text.literal("Выйти из игры"), button -> client.scheduleStop())
			.dimensions(center + 2, y, 98, 20)
			.build());
		y += 38;

		List<IconButton> icons = new ArrayList<>();
		icons.add(new IconButton("language", "Язык", button -> client.setScreen(new LanguageOptionsScreen(this, client.options, client.getLanguageManager()))));
		if (FabricLoader.getInstance().isModLoaded("notebook")) {
			icons.add(new IconButton("notebook", "Блокнот", button -> openExternal("xyz.sillyjune.notebook.NotebookScreen", false)));
		}
		if (FabricLoader.getInstance().isModLoaded("screenshot_viewer")) {
			icons.add(new IconButton("screenshots", "Скриншоты", button -> openExternal("io.github.lgatodu47.screenshot_viewer.screen.manage_screenshots.ManageScreenshotsScreen", true)));
		}
		int x = center - (icons.size() * 24 - 4) / 2;
		for (IconButton icon : icons) {
			icon.setPosition(x, y);
			addDrawableChild(icon);
			x += 24;
		}

		if (ADDRESS != null && pingInfo == null) {
			ping();
		}
	}

	@Override
	public void tick() {
		if (ADDRESS == null) {
			return;
		}
		pinger.tick();
		if (pinging && pingInfo.label != null && pingInfo.label.getContent() instanceof TranslatableTextContent content && content.getKey().equals("multiplayer.status.cannot_connect")) {
			setStatus(false, null);
		}
		if (++ticks % REPING_TICKS == 0 && !pinging) {
			ping();
		}
	}

	@Override
	public void removed() {
		pinger.cancel();
	}

	@Override
	public boolean shouldCloseOnEsc() {
		return false;
	}

	@Override
	public void renderBackground(DrawContext context, int mouseX, int mouseY, float delta) {
		Panoramas.render();
	}

	@Override
	public void render(DrawContext context, int mouseX, int mouseY, float delta) {
		super.render(context, mouseX, mouseY, delta);
		RenderSystem.enableBlend();
		context.drawTexture(LogoDrawer.LOGO_TEXTURE, logoX, logoY, logoWidth, logoHeight, 0, 0, 256, 44, 256, 64);
		if (ADDRESS != null) {
			Text text = statusText;
			int x = (width - (10 + textRenderer.getWidth(text))) / 2;
			context.fill(x, statusY + 1, x + 6, statusY + 7, statusColor);
			context.drawTextWithShadow(textRenderer, text, x + 10, statusY, 0xFFFFFFFF);
		}
	}

	private void join() {
		ConnectScreen.connect(this, client, ServerAddress.parse(ADDRESS), new ServerInfo("Сервер", ADDRESS, ServerInfo.ServerType.OTHER), false, null);
	}

	private void ping() {
		ServerInfo info = new ServerInfo("Сервер", ADDRESS, ServerInfo.ServerType.OTHER);
		pingInfo = info;
		pinging = true;
		Util.getMainWorkerExecutor().execute(() -> {
			try {
				pinger.add(info, () -> {}, () -> setStatus(true, info));
			} catch (UnknownHostException e) {
				LOGGER.warn("Unknown host {}", ADDRESS);
				setStatus(false, null);
			}
		});
	}

	private void setStatus(boolean online, ServerInfo info) {
		pinging = false;
		statusColor = online ? COLOR_ONLINE : COLOR_OFFLINE;
		if (!online) {
			statusText = Text.literal("Сервер недоступен");
		} else if (info.players != null) {
			statusText = Text.literal("Сервер онлайн · " + info.players.online() + " из " + info.players.max());
		} else {
			statusText = Text.literal("Сервер онлайн");
		}
	}

	private void openExternal(String className, boolean withParent) {
		try {
			Class<?> type = Class.forName(className);
			client.setScreen((Screen) (withParent ? type.getConstructor(Screen.class).newInstance(this) : type.getConstructor().newInstance()));
		} catch (ReflectiveOperationException | RuntimeException e) {
			LOGGER.warn("Failed to open {}", className, e);
		}
	}

	private static class JoinButton extends ButtonWidget {
		JoinButton(int x, int y, Text message, PressAction onPress) {
			super(x, y, 200, 24, message, onPress, DEFAULT_NARRATION_SUPPLIER);
		}

		@Override
		protected void renderWidget(DrawContext context, int mouseX, int mouseY, float delta) {
			RenderSystem.enableBlend();
			context.drawGuiTexture(active && isSelected() ? JOIN_HIGHLIGHTED : JOIN, getX(), getY(), getWidth(), getHeight());
			drawMessage(context, MinecraftClient.getInstance().textRenderer, active ? 0xFFFFFFFF : 0xFFA0A0A0);
		}
	}

	private static class IconButton extends ButtonWidget {
		private final Identifier icon;

		IconButton(String icon, String tooltip, PressAction onPress) {
			super(0, 0, 20, 20, Text.literal(tooltip), onPress, DEFAULT_NARRATION_SUPPLIER);
			this.icon = Identifier.of("agonmenu", "icon/" + icon);
			setTooltip(Tooltip.of(getMessage()));
		}

		@Override
		public void drawMessage(DrawContext context, TextRenderer textRenderer, int color) {
			context.drawGuiTexture(icon, getX() + 6, getY() + 6, 8, 8);
		}
	}
}
