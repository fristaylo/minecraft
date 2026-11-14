package com.wdiscute.starcatcher.registry;

import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.KeyMapping;
import org.lwjgl.glfw.GLFW;

public interface SCKeymappings
{
    String CATEGORY = "key.category.starcatcher.starcatcher";

    KeyMapping MINIGAME_HIT = new KeyMapping("key.starcatcher.minigame_hit", GLFW.GLFW_KEY_SPACE, CATEGORY);
    KeyMapping EXPAND_TOURNAMENT = new KeyMapping("key.starcatcher.expand_tournament",
            InputConstants.Type.KEYSYM,
            GLFW.GLFW_KEY_TAB, CATEGORY);

    KeyMapping OPEN_GUIDE = new KeyMapping("key.starcatcher.open_guide",
            InputConstants.Type.KEYSYM,
            InputConstants.UNKNOWN.getValue(), CATEGORY);
}
