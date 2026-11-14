package agon.minimap.config;

import me.shedaniel.autoconfig.ConfigData;
import me.shedaniel.autoconfig.annotation.Config;
import me.shedaniel.autoconfig.annotation.ConfigEntry;

@Config(name = "atlasminimap")
public class MinimapConfig implements ConfigData {
    public boolean enabled = true;

    @ConfigEntry.BoundedDiscrete(min = 48, max = 160)
    public int size = 86;

    @ConfigEntry.BoundedDiscrete(min = 1, max = 16)
    public int tileChunks = 6;

    public boolean showCoordinates = true;
}
