package org.silkframework.workspace.resources

import org.silkframework.runtime.plugin.PluginModule

class ResourceRepositoryPlugins extends PluginModule {

  override def pluginClasses: Seq[Class[_]] =
    Seq(classOf[PerProjectFileRepository], classOf[SharedFileRepository], classOf[InMemoryResourceRepository], classOf[EmptyResourceRepository])
}
