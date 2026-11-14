package agon.minimap.config;

import me.shedaniel.autoconfig.ConfigData;
import me.shedaniel.autoconfig.annotation.Config;

@Config(name = "atlasminimap")
public class MinimapConfig implements ConfigData {
    public boolean enabled = true;
    public Size size = Size.MEDIUM;
    public Zoom zoom = Zoom.FOUR;
    public boolean showCoordinates = true;

    public enum Size {
        SMALL(92),
        MEDIUM(112),
        LARGE(140);

        public final int pixels;

        Size(int pixels) {
            this.pixels = pixels;
        }
    }

    public enum Zoom {
        ONE(1),
        TWO(2),
        FOUR(4);

        public final int chunks;

        Zoom(int chunks) {
            this.chunks = chunks;
        }
    }
}
