package agon.minimap;

import agon.minimap.config.MinimapConfig;
import com.mojang.blaze3d.systems.RenderSystem;
import folk.sisby.antique_atlas.AntiqueAtlas;
import folk.sisby.antique_atlas.WorldAtlasData;
import folk.sisby.antique_atlas.gui.AtlasRenderer;
import folk.sisby.antique_atlas.gui.AtlasScreen;
import folk.sisby.antique_atlas.util.DrawUtil;
import folk.sisby.antique_atlas.util.MathUtil;
import folk.sisby.surveyor.client.SurveyorClient;
import folk.sisby.surveyor.landmark.component.LandmarkComponentTypes;
import me.shedaniel.autoconfig.AutoConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.client.util.math.Rect2i;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.registry.RegistryKey;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;
import org.joml.Vector2d;

import java.util.Map;

public class MinimapHud {
    private static final int MARGIN = 4;
    private static final int INSET = 4;
    private static final int FRAME_THICKNESS = 4;
    private static final int[] FRAME_LEFT = {0, 3, 5, 7};
    private static final int[] FRAME_TOP = {0, 3, 5, 6};
    private static final int[] FRAME_BOTTOM = {217, 213, 211, 210};
    private static final int[] CORNER_COLORS = {0xFF1C0F00, 0xFF75321E, 0xFF6A2C19, 0xFF4C1A0B};
    private static final int SHADOW_COLOR = 0xD91C0F00;
    private static final int LETTER_COLOR = 0xFFD6B278;
    private static final int DIGIT_COLOR = 0xFFF4E8CC;
    private static final int GLYPH_HEIGHT = 5;
    private static final Map<Character, String> GLYPHS = Map.ofEntries(
            Map.entry('0', "###" + "#.#" + "#.#" + "#.#" + "###"),
            Map.entry('1', ".#." + "##." + ".#." + ".#." + "###"),
            Map.entry('2', "##." + "..#" + ".#." + "#.." + "###"),
            Map.entry('3', "##." + "..#" + ".#." + "..#" + "##."),
            Map.entry('4', "#.#" + "#.#" + "###" + "..#" + "..#"),
            Map.entry('5', "###" + "#.." + "##." + "..#" + "##."),
            Map.entry('6', ".##" + "#.." + "###" + "#.#" + "###"),
            Map.entry('7', "###" + "..#" + ".#." + ".#." + ".#."),
            Map.entry('8', "###" + "#.#" + "###" + "#.#" + "###"),
            Map.entry('9', "###" + "#.#" + "###" + "..#" + "##."),
            Map.entry('-', ".." + ".." + "##" + ".." + ".."),
            Map.entry(' ', ".........."),
            Map.entry('X', "#.#" + "#.#" + ".#." + "#.#" + "#.#"),
            Map.entry('Y', "#.#" + "#.#" + ".#." + ".#." + ".#."),
            Map.entry('Z', "###" + "..#" + ".#." + "#.." + "###"));

    static void render(DrawContext context, RenderTickCounter tickCounter) {
        MinecraftClient client = MinecraftClient.getInstance();
        MinimapConfig config = AutoConfig.getConfigHolder(MinimapConfig.class).getConfig();
        if (!config.enabled || client.options.hudHidden || client.getDebugHud().shouldShowDebugHud()
                || client.currentScreen instanceof AtlasScreen || client.world == null || client.player == null) {
            return;
        }
        float delta = tickCounter.getTickDelta(false);
        int size = config.size;
        int x = context.getScaledWindowWidth() - MARGIN - size;
        int y = MARGIN;
        int mapSize = size - INSET * 2;
        int mapX = x + INSET;
        int mapY = y + INSET;
        RegistryKey<World> dim = client.world.getRegistryKey();
        Minimap atlas = new Minimap(
                mapX - AtlasRenderer.MAP_BORDER_WIDTH, mapY - AtlasRenderer.MAP_BORDER_HEIGHT, mapSize, config.tileChunks,
                client.getWindow().getScaleFactor(), client.player, client.player.getLerpedPos(delta),
                WorldAtlasData.getOrCreate(dim), dim);
        MatrixStack matrices = context.getMatrices();

        context.draw();
        RenderSystem.setShaderColor(1, 1, 1, 1);
        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();
        context.drawTexture(AtlasRenderer.BOOK, mapX, mapY, mapSize, mapSize, 22, 22, 118, 174, 310, 218);

        context.enableScissor(mapX, mapY, mapX + mapSize, mapY + mapSize);
        atlas.renderTiles(matrices, null, AtlasRenderer.MAX_LIGHT);
        matrices.push();
        matrices.translate(atlas.bookX(), atlas.bookY(), 0);
        Rect2i mapArea = new Rect2i(AtlasRenderer.MAP_BORDER_WIDTH, AtlasRenderer.MAP_BORDER_HEIGHT, mapSize, mapSize);
        atlas.worldAtlasData().getAllMarkers(atlas.tileChunks()).forEach((landmark, texture) -> {
            if (landmark.get(LandmarkComponentTypes.POS) != null) {
                atlas.renderMarker(matrices, null, landmark, texture, 0, AtlasRenderer.MAX_LIGHT,
                        (markerX, markerY) -> (float) MathHelper.clamp(MathUtil.innerDistanceToEdge(mapArea, new Vector2d(markerX, markerY)) / 32.0, 0, 1),
                        false, false, 1);
            }
        });
        AntiqueAtlas.getOrderedFriends().forEach((uuid, friend) -> {
            if (friend != null && !uuid.equals(SurveyorClient.getClientUuid())) {
                atlas.renderPlayer(matrices, null, 0, AtlasRenderer.MAX_LIGHT, friend, 1, 1, false, false);
            }
        });
        matrices.pop();
        DrawUtil.drawCenteredWithRotation(matrices, null, AtlasRenderer.PLAYER, mapX + mapSize / 2.0, mapY + mapSize / 2.0, 0, 1,
                AtlasRenderer.PLAYER_ICON_WIDTH, AtlasRenderer.PLAYER_ICON_HEIGHT, client.player.getYaw(delta), AtlasRenderer.MAX_LIGHT, 0xFFFFFFFF);
        context.disableScissor();

        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();
        drawFrame(context, x, y, size);

        if (config.showCoordinates) {
            drawCoordinates(context, client.player, x, y, size);
        }
    }

    private record Minimap(int bookX, int bookY, int mapWidth, int tileChunks, double guiScale, PlayerEntity player, Vec3d position,
                           WorldAtlasData worldAtlasData, RegistryKey<World> dim) implements AtlasRenderer {
        @Override
        public int bookWidth() {
            return mapWidth + MAP_BORDER_WIDTH * 2;
        }

        @Override
        public int bookHeight() {
            return mapWidth + MAP_BORDER_HEIGHT * 2;
        }

        @Override
        public int mapHeight() {
            return mapWidth;
        }

        @Override
        public double mapOffsetX() {
            return -position.x * getPixelsPerBlock();
        }

        @Override
        public double mapOffsetY() {
            return -position.z * getPixelsPerBlock();
        }

        @Override
        public int tilePixels() {
            return 16;
        }

        @Override
        public int mapScale() {
            return (int) guiScale;
        }

        @Override
        public double getPixelsPerBlock() {
            return tilePixels() / (tileChunks * 16.0);
        }
    }

    private static void drawFrame(DrawContext context, int x, int y, int size) {
        for (int k = 0; k < FRAME_THICKNESS; k++) {
            context.drawTexture(AtlasRenderer.BOOK_FRAME, x + k, y + INSET, 1, size - INSET * 2, FRAME_LEFT[k], 40, 1, 120, 310, 218);
            context.drawTexture(AtlasRenderer.BOOK_FRAME, x + size - 1 - k, y + INSET, 1, size - INSET * 2, FRAME_LEFT[k], 40, 1, 120, 310, 218);
            context.drawTexture(AtlasRenderer.BOOK_FRAME, x + INSET, y + k, size - INSET * 2, 1, 40, FRAME_TOP[k], 60, 1, 310, 218);
            context.drawTexture(AtlasRenderer.BOOK_FRAME, x + INSET, y + size - 1 - k, size - INSET * 2, 1, 40, FRAME_BOTTOM[k], 60, 1, 310, 218);
        }
        for (int cy = 0; cy < FRAME_THICKNESS; cy++) {
            for (int cx = 0; cx < FRAME_THICKNESS; cx++) {
                if (cx + cy > 1) {
                    int color = CORNER_COLORS[cx + cy == 2 ? 0 : Math.min(cx, cy)];
                    context.fill(x + cx, y + cy, x + cx + 1, y + cy + 1, color);
                    context.fill(x + size - 1 - cx, y + cy, x + size - cx, y + cy + 1, color);
                    context.fill(x + cx, y + size - 1 - cy, x + cx + 1, y + size - cy, color);
                    context.fill(x + size - 1 - cx, y + size - 1 - cy, x + size - cx, y + size - cy, color);
                }
            }
        }
    }

    private static void drawCoordinates(DrawContext context, ClientPlayerEntity player, int x, int y, int size) {
        int blockX = player.getBlockX();
        int blockZ = player.getBlockZ();
        String[] candidates = {"X" + blockX + " Y" + player.getBlockY() + " Z" + blockZ, "X" + blockX + " Z" + blockZ, blockX + " " + blockZ};
        String text = candidates[candidates.length - 1];
        for (String candidate : candidates) {
            if (textWidth(candidate) <= size) {
                text = candidate;
                break;
            }
        }
        int textX = x + (size - textWidth(text)) / 2;
        int textY = y + size + 2;
        drawText(context, text, textX + 1, textY + 1, true);
        drawText(context, text, textX, textY, false);
    }

    private static int textWidth(String text) {
        int width = -1;
        for (char c : text.toCharArray()) {
            width += GLYPHS.get(c).length() / GLYPH_HEIGHT + 1;
        }
        return width;
    }

    private static void drawText(DrawContext context, String text, int x, int y, boolean shadow) {
        int cursor = x;
        for (char c : text.toCharArray()) {
            String glyph = GLYPHS.get(c);
            int width = glyph.length() / GLYPH_HEIGHT;
            int color = shadow ? SHADOW_COLOR : Character.isLetter(c) ? LETTER_COLOR : DIGIT_COLOR;
            for (int i = 0; i < glyph.length(); i++) {
                if (glyph.charAt(i) == '#') {
                    int pixelX = cursor + i % width;
                    int pixelY = y + i / width;
                    context.fill(pixelX, pixelY, pixelX + 1, pixelY + 1, color);
                }
            }
            cursor += width + 1;
        }
    }
}
