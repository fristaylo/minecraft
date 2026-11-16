package agon.minimap.config;

import com.terraformersmc.modmenu.api.ConfigScreenFactory;
import com.terraformersmc.modmenu.api.ModMenuApi;
import me.shedaniel.autoconfig.AutoConfig;
import me.shedaniel.clothconfig2.api.ConfigEntryBuilder;
import net.minecraft.text.Text;

import java.util.List;

public class ModMenuIntegration implements ModMenuApi {
    @Override
    public ConfigScreenFactory<?> getModConfigScreenFactory() {
        AutoConfig.getGuiRegistry(MinimapConfig.class).registerPredicateProvider(
                (i13n, field, config, defaults, registry) -> List.of(ConfigEntryBuilder.create()
                        .startIntSlider(Text.translatable(i13n), Integer.numberOfTrailingZeros(((MinimapConfig) config).tileChunks), 0, 4)
                        .setDefaultValue(Integer.numberOfTrailingZeros(((MinimapConfig) defaults).tileChunks))
                        .setTextGetter(power -> Text.literal(String.valueOf(1 << power)))
                        .setSaveConsumer(power -> ((MinimapConfig) config).tileChunks = 1 << power)
                        .build()),
                field -> field.getName().equals("tileChunks"));
        return parent -> AutoConfig.getConfigScreen(MinimapConfig.class, parent).get();
    }
}
