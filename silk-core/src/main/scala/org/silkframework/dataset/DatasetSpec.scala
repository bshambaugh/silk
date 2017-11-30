/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.silkframework.dataset

import java.util.logging.Logger

import org.silkframework.config.Task.TaskFormat
import org.silkframework.config.TaskSpec
import org.silkframework.entity._
import org.silkframework.runtime.serialization.{ReadContext, WriteContext, XmlFormat, XmlSerialization}
import org.silkframework.util.Uri

import scala.language.implicitConversions
import scala.xml.Node

/**
  * A dataset of entities.
  */
case class DatasetSpec(plugin: Dataset, uriProperty: Option[Uri] = None) extends TaskSpec with Dataset {

  private val log = Logger.getLogger(DatasetSpec.getClass.getName)

  lazy val source: DataSource = new EntitySourceWrapper

  lazy val entitySink: EntitySink = new EntitySinkWrapper

  lazy val linkSink: LinkSink = new LinkSinkWrapper

  /** Datasets don't define input schemata, because any data can be written to them. */
  override lazy val inputSchemataOpt: Option[Seq[EntitySchema]] = None

  /** Datasets don't have a static EntitySchema. It is defined by the following task. */
  override lazy val outputSchemaOpt: Option[EntitySchema] = None

  private class EntitySourceWrapper extends DataSource {

    /**
      * Retrieves entities from this source which satisfy a specific entity schema.
      *
      * @param entitySchema The entity schema
      * @param limit        Limits the maximum number of retrieved entities
      * @return A Traversable over the entities. The evaluation of the Traversable may be non-strict.
      */
    override def retrieve(entitySchema: EntitySchema, limit: Option[Int]): Traversable[Entity] = {
      val adaptedSchema = adaptSchema(entitySchema)
      val entities = plugin.source.retrieve(adaptedSchema, limit)
      adaptUris(entities, adaptedSchema)
    }

    /**
      * Retrieves a list of entities from this source.
      *
      * @param entitySchema The entity schema
      * @param entities     The URIs of the entities to be retrieved.
      * @return A Traversable over the entities. The evaluation of the Traversable may be non-strict.
      */
    override def retrieveByUri(entitySchema: EntitySchema, entities: Seq[Uri]): Seq[Entity] = {
      val adaptedSchema = adaptSchema(entitySchema)
      val retrievedEntities = plugin.source.retrieveByUri(adaptedSchema, entities)
      adaptUris(retrievedEntities, adaptedSchema).toSeq
    }

    /**
      * Adds the URI property to the schema.
      */
    private def adaptSchema(entitySchema: EntitySchema): EntitySchema = {
      uriProperty match {
        case Some(property) =>
          entitySchema.copy(typedPaths = entitySchema.typedPaths :+ TypedPath(Path.parse(property.uri), UriValueType))
        case None =>
          entitySchema
      }
    }

    /**
      * Rewrites the entity URIs if an URI property has been specified.
      */
    private def adaptUris(entities: Traversable[Entity], entitySchema: EntitySchema): Traversable[Entity] = {
      uriProperty match {
        case Some(property) =>
          val uriIndex = entitySchema.pathIndex(Path.parse(property.uri))
          for (entity <- entities) yield {
            new Entity(
              uri = entity.evaluate(uriIndex).headOption.getOrElse(entity.uri),
              values = entity.values,
              desc = entity.desc
            )
          }
        case None =>
          entities
      }
    }
  }

  private class EntitySinkWrapper extends EntitySink {

    private var entityCount: Int = 0

    private var isOpen = false

    private val writer = plugin.entitySink

    /**
      * Initializes this writer.
      */
    override def openTable(typeUri: Uri, properties: Seq[TypedProperty]) {
      if (isOpen) {
        writer.close()
        isOpen = false
      }

      val uriTypedProperty =
        for(property <- uriProperty.toIndexedSeq) yield {
          TypedProperty(property.uri, UriValueType, isBackwardProperty = false)
        }

      writer.openTable(typeUri, uriTypedProperty ++ properties)
      entityCount = 0
      isOpen = true
    }

    override def writeEntity(subject: String, values: Seq[Seq[String]]) {
      require(isOpen, "Output must be opened before writing statements to it")
      uriProperty match {
        case Some(property) =>
          writer.writeEntity(subject, Seq(subject) +: values)
        case None =>
          writer.writeEntity(subject, values)
      }

      entityCount += 1
    }

    /**
      * Closes the current table.
      */
    override def closeTable() {
      if (writer != null) writer.closeTable()
      isOpen = false
    }

    /**
      * Closes this writer.
      */
    override def close() {
      if (writer != null) writer.close()
      isOpen = false
      log.info(s"Wrote $entityCount entities.")
    }

    /**
      * Makes sure that the next write will start from an empty dataset.
      */
    override def clear(): Unit = writer.clear()
  }

  private class LinkSinkWrapper extends LinkSink {

    private var linkCount: Int = 0

    private var isOpen = false

    private val writer = plugin.linkSink

    override def init(): Unit = {
      if (isOpen) {
        writer.close()
        isOpen = false
      }
      writer.init()
      isOpen = true
    }

    /**
      * Writes a new link to this writer.
      */
    override def writeLink(link: Link, predicateUri: String) {
      //require(isOpen, "Output must be opened before writing statements to it")

      writer.writeLink(link, predicateUri)
      linkCount += 1
    }

    /**
      * Closes this writer.
      */
    override def close() {
      if (writer != null) writer.close()
      isOpen = false
      log.info(s"Wrote $linkCount links.")
    }

    /**
      * Makes sure that the next write will start from an empty dataset.
      */
    override def clear(): Unit = writer.clear()
  }
}

object DatasetSpec {

  def empty = {
    new DatasetSpec(EmptyDataset)
  }

  /**
    * XML serialization format.
    */
  implicit object DatasetSpecFormat extends XmlFormat[DatasetSpec] {

    def read(node: Node)(implicit readContext: ReadContext): DatasetSpec = {
      implicit val prefixes = readContext.prefixes
      implicit val resources = readContext.resources

      // Check if the data source still uses the old outdated XML format
      if (node.label == "DataSource" || node.label == "Output") {
        // Read old format
        val id = (node \ "@id").text
        new DatasetSpec(
          plugin = Dataset((node \ "@type").text, XmlSerialization.deserializeParameters(node))
        )
      } else {
        // Read new format
        val id = (node \ "@id").text
        val uriProperty = (node \ "@uriProperty").headOption.map(_.text).filter(_.trim.nonEmpty).map(Uri(_))
        // In outdated formats the plugin parameters are nested inside a DatasetPlugin node
        val sourceNode = (node \ "DatasetPlugin").headOption.getOrElse(node)
        new DatasetSpec(
          plugin = Dataset((sourceNode \ "@type").text, XmlSerialization.deserializeParameters(sourceNode)),
          uriProperty = uriProperty
        )
      }
    }

    def write(value: DatasetSpec)(implicit writeContext: WriteContext[Node]): Node = {
      value.plugin match {
        case Dataset(pluginDesc, params) =>
          <Dataset type={pluginDesc.id} uriProperty={value.uriProperty.map(_.uri).getOrElse("")}>
            {XmlSerialization.serializeParameter(params)}
          </Dataset>
      }
    }
  }

  implicit object DatasetTaskFormat extends TaskFormat[DatasetSpec]

}