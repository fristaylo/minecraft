package com.wdiscute.starcatcher.registry;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mojang.serialization.Codec;
import com.mojang.serialization.JsonOps;
import com.wdiscute.starcatcher.SCTags;
import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.blocks.aquarium.AquariumBlock;
import com.wdiscute.starcatcher.data.network.CBDataMapsPayload;
import com.wdiscute.starcatcher.fish.FishProperties;
import com.wdiscute.starcatcher.fish.Treasure;
import com.wdiscute.starcatcher.modifiers.Modifier;
import com.wdiscute.starcatcher.registry.tackleskin.AbstractTackleSkin;
import net.fabricmc.fabric.api.event.lifecycle.v1.CommonLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.fabricmc.fabric.api.registry.CompostingChanceRegistry;
import net.fabricmc.fabric.api.resource.IdentifiableResourceReloadListener;
import net.fabricmc.fabric.api.resource.ResourceManagerHelper;
import net.minecraft.core.Holder;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.packs.PackType;
import net.minecraft.server.packs.resources.Resource;
import net.minecraft.server.packs.resources.ResourceManager;
import net.minecraft.server.packs.resources.SimplePreparableReloadListener;
import net.minecraft.tags.TagKey;
import net.minecraft.util.GsonHelper;
import net.minecraft.util.profiling.ProfilerFiller;
import net.minecraft.world.effect.MobEffect;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.level.dimension.LevelStem;

import java.io.BufferedReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class SCDataMaps
{
    public static final DataMap<Item, AquariumBlock.Interaction> AQUARIUM_INTERACTION = new DataMap<>(
            Starcatcher.rl("aquarium_interaction"), Registries.ITEM, AquariumBlock.Interaction.CODEC);

    public static final DataMap<Item, List<Modifier>> ITEM_MODIFIERS = new DataMap<>(
            Starcatcher.rl("modifiers"), Registries.ITEM, Modifier.CODEC.listOf());

    public static final DataMap<MobEffect, List<Modifier>> EFFECT_MODIFIERS = new DataMap<>(
            Starcatcher.rl("modifiers"), Registries.MOB_EFFECT, Modifier.CODEC.listOf());

    public static final DataMap<Enchantment, List<Modifier>> ENCHANTMENT_MODIFIERS = new DataMap<>(
            Starcatcher.rl("modifiers"), Registries.ENCHANTMENT, Modifier.CODEC.listOf());

    public static final DataMap<Item, AbstractTackleSkin> TACKLE_SKIN = new DataMap<>(
            Starcatcher.rl("tackle_skin"), Registries.ITEM, Starcatcher.TACKLE_SKIN_REGISTRY.byNameCodec());

    public static final DataMap<FishProperties, Treasure> TREASURE = new DataMap<>(
            Starcatcher.rl("treasures"), Starcatcher.FISH_REGISTRY_KEY, Treasure.CODEC);

    public static final DataMap<LevelStem, ResourceLocation> MESSAGE_BACKGROUND = new DataMap<>(
            Starcatcher.rl("message_background"), Registries.LEVEL_STEM, ResourceLocation.CODEC);

    public static void register()
    {
        ResourceManagerHelper.get(PackType.SERVER_DATA).registerReloadListener(new DataMapsReloadListener());

        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> sender.sendPacket(syncPayload()));

        ServerLifecycleEvents.END_DATA_PACK_RELOAD.register((server, resourceManager, success) ->
                server.getPlayerList().getPlayers().forEach(player -> ServerPlayNetworking.send(player, syncPayload())));

        CommonLifecycleEvents.TAGS_LOADED.register((registries, client) ->
        {
            registerCompostable(SCTags.BUCKETABLE_FISHES, 0.9f);
            registerCompostable(SCTags.WORMS, 0.65f);
        });
    }

    public static <T> T getOrDefault(ItemStack stack, DataMap<Item, T> dataMap, T d)
    {
        T data = dataMap.get(stack.getItemHolder());
        if (data == null) return d;
        return data;
    }

    public static void applySync(Map<ResourceLocation, String> json)
    {
        DataMap.ALL.forEach(map -> map.apply(JsonParser.parseString(json.get(map.file)).getAsJsonObject()));
    }

    private static CBDataMapsPayload syncPayload()
    {
        Map<ResourceLocation, String> json = new HashMap<>();
        DataMap.ALL.forEach(map -> json.put(map.file, map.json.toString()));
        return new CBDataMapsPayload(json);
    }

    private static void registerCompostable(TagKey<Item> tag, float chance)
    {
        BuiltInRegistries.ITEM.getTagOrEmpty(tag).forEach(item -> CompostingChanceRegistry.INSTANCE.add(item.value(), chance));
    }

    public static class DataMap<R, T>
    {
        private static final List<DataMap<?, ?>> ALL = new ArrayList<>();

        private final ResourceKey<? extends Registry<R>> registry;
        private final Codec<T> codec;
        private final ResourceLocation file;
        private final Map<ResourceKey<R>, T> values = new HashMap<>();
        private final Map<TagKey<R>, T> tagValues = new LinkedHashMap<>();
        private JsonObject json = new JsonObject();

        private DataMap(ResourceLocation id, ResourceKey<? extends Registry<R>> registry, Codec<T> codec)
        {
            this.registry = registry;
            this.codec = codec;
            String registryPath = registry.location().getNamespace().equals("minecraft")
                    ? registry.location().getPath()
                    : registry.location().getNamespace() + "/" + registry.location().getPath();
            this.file = ResourceLocation.fromNamespaceAndPath(id.getNamespace(), "starcatcher_data_maps/" + registryPath + "/" + id.getPath() + ".json");
            ALL.add(this);
        }

        public T get(Holder<R> holder)
        {
            T value = values.get(holder.unwrapKey().orElse(null));
            if (value != null) return value;

            for (Map.Entry<TagKey<R>, T> entry : tagValues.entrySet())
            {
                if (holder.is(entry.getKey())) return entry.getValue();
            }
            return null;
        }

        private void apply(JsonObject json)
        {
            this.json = json;
            values.clear();
            tagValues.clear();

            for (Map.Entry<String, JsonElement> entry : json.entrySet())
            {
                boolean isTag = entry.getKey().startsWith("#");
                ResourceLocation id = ResourceLocation.tryParse(isTag ? entry.getKey().substring(1) : entry.getKey());

                if (id == null)
                {
                    Starcatcher.LOGGER.error("Invalid key {} in {}", entry.getKey(), file);
                    continue;
                }

                codec.parse(JsonOps.INSTANCE, entry.getValue())
                        .resultOrPartial(error -> Starcatcher.LOGGER.error("Failed to parse {} in {}: {}", entry.getKey(), file, error))
                        .ifPresent(value ->
                        {
                            if (isTag) tagValues.put(TagKey.create(registry, id), value);
                            else values.put(ResourceKey.create(registry, id), value);
                        });
            }
        }
    }

    private static class DataMapsReloadListener extends SimplePreparableReloadListener<Map<DataMap<?, ?>, JsonObject>> implements IdentifiableResourceReloadListener
    {
        private static final Gson GSON = new Gson();

        @Override
        public ResourceLocation getFabricId()
        {
            return Starcatcher.rl("data_maps");
        }

        @Override
        protected Map<DataMap<?, ?>, JsonObject> prepare(ResourceManager resourceManager, ProfilerFiller profiler)
        {
            Map<DataMap<?, ?>, JsonObject> merged = new HashMap<>();

            for (DataMap<?, ?> map : DataMap.ALL)
            {
                JsonObject values = new JsonObject();

                for (Resource resource : resourceManager.getResourceStack(map.file))
                {
                    try (BufferedReader reader = resource.openAsReader())
                    {
                        GsonHelper.fromJson(GSON, reader, JsonObject.class).getAsJsonObject("values")
                                .entrySet().forEach(entry -> values.add(entry.getKey(), entry.getValue()));
                    } catch (Exception e)
                    {
                        Starcatcher.LOGGER.error("Failed to read {}", map.file, e);
                    }
                }

                merged.put(map, values);
            }
            return merged;
        }

        @Override
        protected void apply(Map<DataMap<?, ?>, JsonObject> merged, ResourceManager resourceManager, ProfilerFiller profiler)
        {
            merged.forEach(DataMap::apply);
        }
    }
}
