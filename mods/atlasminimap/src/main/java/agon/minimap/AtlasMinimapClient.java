package agon.minimap;

import agon.minimap.config.MinimapConfig;
import me.shedaniel.autoconfig.AutoConfig;
import me.shedaniel.autoconfig.ConfigHolder;
import me.shedaniel.autoconfig.serializer.GsonConfigSerializer;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

public class AtlasMinimapClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        ConfigHolder<MinimapConfig> holder = AutoConfig.register(MinimapConfig.class, GsonConfigSerializer::new);
        KeyBinding toggle = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.atlasminimap.toggle", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_H, "key.categories.atlasminimap"));
        HudRenderCallback.EVENT.register(MinimapHud::render);
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (toggle.wasPressed()) {
                holder.getConfig().enabled = !holder.getConfig().enabled;
                holder.save();
            }
        });
    }
}
