package agon.minimap.config;

import me.shedaniel.autoconfig.ConfigData;
import me.shedaniel.autoconfig.annotation.Config;
import me.shedaniel.autoconfig.annotation.ConfigEntry;

@Config(name = "atlasminimap")
public class MinimapConfig implements ConfigData {
    public boolean enabled = true;

    @ConfigEntry.BoundedDiscrete(min = 48, max = 160)
    public int size = 86;

    public int tileChunks = 8;

    public boolean showCoordinates = true;

    @Override
    public void validatePostLoad() {
        int snapped = 1;
        for (int candidate = 2; candidate <= 16; candidate *= 2) {
            if (Math.abs(candidate - tileChunks) <= Math.abs(snapped - tileChunks)) {
                snapped = candidate;
            }
        }
        tileChunks = snapped;
    }
}
