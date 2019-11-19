import React from 'react';
import {
    Button,
    DisruptiveButton,
    Card,
    CardContent,
    CardActions,
} from '@eccenca/gui-elements';
import _ from 'lodash';
import PropTypes from 'prop-types';
import ExampleView from './ExampleView';
import { getEditorHref } from '../../store';
import ValueMappingRuleForm from './ValueMappingRuleForm';
import {
    PropertyTypeDescription,
} from '../../Components/PropertyTypeDescription';
import { MAPPING_RULE_TYPE_DIRECT } from '../../utils/constants';
import { MESSAGES } from '../../utils/constants';
import EventEmitter from '../../utils/EventEmitter';
import { ThingName } from '../../Components/ThingName';
import { ThingDescription } from '../../Components/ThingDescription';
import { InfoBox } from '../../Components/InfoBox';
import { PropertyTypeLabel } from '../../Components/PropertyTypeLabel';

const propertyTypeLabel = valueType => {
    // Adds optional properties of the property type to the label, e.g. language tag
    if (typeof valueType.lang === 'string') {
        return ` (${valueType.lang})`;
    }
    return '';
};

class RuleValueView extends React.Component {
    // define property types
    static propTypes = {
        comment: PropTypes.string,
        id: PropTypes.string,
        type: PropTypes.string,
        sourcePath: PropTypes.string,
        mappingTarget: PropTypes.object,
        edit: PropTypes.bool.isRequired,
    };

    state = {
        edit: this.props.edit,
        href: getEditorHref(this.props.id),
    };
    
    constructor(props) {
        super(props);
        this.handleCloseEdit = this.handleCloseEdit.bind(this);
        this.handleComplexEdit = this.handleComplexEdit.bind(this);
        this.handleEdit = this.handleEdit.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleCopy = this.handleCopy.bind(this);
        this.handleClone = this.handleClone.bind(this);
    }
    
    componentDidMount() {
        EventEmitter.on(MESSAGES.RULE_VIEW.CLOSE, this.handleCloseEdit);
    }

    componentWillUnmount() {
        EventEmitter.off(MESSAGES.RULE_VIEW.CLOSE, this.handleCloseEdit);
    }

    handleCloseEdit(obj) {
        if (obj.id === this.props.id) {
            this.setState({ edit: false });
        }
    };

    handleComplexEdit(event) {
        if (__DEBUG__) {
            event.stopPropagation();
            alert('Normally this would open the complex editor (aka jsplumb view)');
            return false;
        }
    };

    // open view in edit mode
    handleEdit(event) {
        event.stopPropagation();
        this.setState({
            edit: !this.state.edit,
        });
    };

    handleClose(event) {
        event.stopPropagation();
        EventEmitter.emit(MESSAGES.RULE_VIEW.UNCHANGED, { id: this.props.id });
    };

    getOperators(operator, accumulator) {
        if (_.has(operator, 'function')) {
            if (_.has(operator, 'inputs')) {
                _.forEach(
                    operator.inputs,
                    input =>
                        (accumulator = _.concat(
                            accumulator,
                            this.getOperators(input, [])
                        ))
                );
            }
            accumulator.push(operator.function);
        }

        return accumulator;
    }

    handleCopy() {
        this.props.handleCopy(this.props.id, this.props.type);
    };

    handleClone() {
        this.props.handleClone(this.props.id, this.props.type);
    };

    // template rendering
    render() {
        const { edit } = this.state;
        const paths = _.get(this, 'props.sourcePaths', []);
        const operators = this.getOperators(this.props.operator, []);

        if (edit) {
            return (
                <ValueMappingRuleForm
                    id={this.props.id}
                    parentId={this.props.parentId}
                />
            );
        }

        const nodeType = _.get(
            this.props,
            'mappingTarget.valueType.nodeType',
            false
        );

        return (
            <div className="ecc-silk-mapping__rulesviewer">
                <Card shadow={0}>
                    <CardContent>
                        {_.get(this.props, 'mappingTarget.uri', false) ? (
                            <div className="ecc-silk-mapping__rulesviewer__targetProperty">
                                <dl className="ecc-silk-mapping__rulesviewer__attribute">
                                    <dt className="ecc-silk-mapping__rulesviewer__attribute-label">
                                        Target property
                                    </dt>
                                    <dd>
                                        <InfoBox>
                                            <div className="ecc-silk-mapping__rulesviewer__attribute-title ecc-silk-mapping__rulesviewer__infobox-main">
                                                <ThingName
                                                    id={_.get(
                                                        this.props,
                                                        'mappingTarget.uri',
                                                        undefined
                                                    )}
                                                />
                                            </div>
                                            <div className="ecc-silk-mapping__rulesviewer__attribute-info ecc-silk-mapping__rulesviewer__infobox-main">
                                                <code>
                                                    {_.get(
                                                        this.props,
                                                        'mappingTarget.uri',
                                                        undefined
                                                    )}
                                                </code>
                                            </div>
                                            <div className="ecc-silk-mapping__rulesviewer__attribute-info ecc-silk-mapping__rulesviewer__infobox-sub">
                                                <ThingDescription
                                                    id={_.get(
                                                        this.props,
                                                        'mappingTarget.uri',
                                                        undefined
                                                    )}
                                                />
                                            </div>
                                        </InfoBox>
                                        {_.get(
                                            this.props,
                                            'mappingTarget.isAttribute',
                                            false
                                        ) ? (
                                                <div>
                                                Values will be written as
                                                attributes if the target dataset
                                                supports it.
                                                </div>
                                            ) : (
                                                false
                                            )}
                                    </dd>
                                </dl>
                            </div>
                        ) : (
                            false
                        )}
                        {nodeType ? (
                            <div className="ecc-silk-mapping__rulesviewer__propertyType">
                                <dl className="ecc-silk-mapping__rulesviewer__attribute">
                                    <dt className="ecc-silk-mapping__rulesviewer__attribute-label">
                                        Data type
                                    </dt>
                                    <dd
                                        key={nodeType}
                                    >
                                        <InfoBox>
                                            <div className="ecc-silk-mapping__rulesviewer__attribute-title ecc-silk-mapping__rulesviewer__infobox-main">
                                                <PropertyTypeLabel
                                                    name={nodeType}
                                                    appendedText={propertyTypeLabel(this.props.mappingTarget.valueType)}
                                                />
                                            </div>
                                            <div className="ecc-silk-mapping__rulesviewer__attribute-info ecc-silk-mapping__rulesviewer__infobox-sub">
                                                <PropertyTypeDescription
                                                    name={nodeType}
                                                />
                                            </div>
                                        </InfoBox>
                                    </dd>
                                </dl>
                            </div>
                        ) : (
                            false
                        )}
                        {this.props.type === MAPPING_RULE_TYPE_DIRECT &&
                        _.get(this.props, 'sourcePath', false) ? (
                                <div className="ecc-silk-mapping__rulesviewer__sourcePath">
                                    <dl className="ecc-silk-mapping__rulesviewer__attribute">
                                        <dt className="ecc-silk-mapping__rulesviewer__attribute-label">
                                        Value path
                                        </dt>
                                        <dd className="ecc-silk-mapping__rulesviewer__attribute-info">
                                            <code>{this.props.sourcePath}</code>
                                            <Button
                                                raised
                                                iconName="edit"
                                                className="ecc-silk-mapping__ruleseditor__actionrow-complex-edit"
                                                onClick={this.handleComplexEdit}
                                                href={this.state.href}
                                                tooltip="Convert value path to value formula"
                                            />
                                        </dd>
                                    </dl>
                                </div>
                            ) : (
                                false
                            )}
                        {this.props.type !== MAPPING_RULE_TYPE_DIRECT &&
                        _.get(this.props, 'sourcePaths', false) ? (
                                <div className="ecc-silk-mapping__rulesviewer__sourcePath">
                                    <dl className="ecc-silk-mapping__rulesviewer__attribute">
                                        <dt className="ecc-silk-mapping__rulesviewer__attribute-label">
                                        Value formula
                                        </dt>
                                        <dd className="ecc-silk-mapping__rulesviewer__attribute-info">
                                        Formula uses {paths.length} value path{paths.length >
                                        1
                                                ? 's'
                                                : ''}:&nbsp;
                                            <code>{paths.join(', ')}</code>
                                        &nbsp;and {operators.length} operator
                                        function{operators.length > 1
                                                ? 's'
                                                : ''}:&nbsp;
                                            <code>{operators.join(', ')}</code>.
                                            <Button
                                                raised
                                                iconName="edit"
                                                className="ecc-silk-mapping__ruleseditor__actionrow-complex-edit"
                                                onClick={this.handleComplexEdit}
                                                href={this.state.href}
                                                tooltip="Edit value formula"
                                            />
                                        </dd>
                                    </dl>
                                </div>
                            ) : (
                                false
                            )}
                        {_.get(this.props, 'id', false) ? (
                            <div className="ecc-silk-mapping__rulesviewer__examples">
                                <dl className="ecc-silk-mapping__rulesviewer__attribute">
                                    <dt className="ecc-silk-mapping__rulesviewer__attribute-label">
                                        Examples of target data
                                    </dt>
                                    <dd>
                                        <ExampleView id={this.props.id} />
                                    </dd>
                                </dl>
                            </div>
                        ) : (
                            false
                        )}
                        {_.get(this.props, 'metadata.label', false) ? (
                            <div className="ecc-silk-mapping__rulesviewer__label">
                                <dl className="ecc-silk-mapping__rulesviewer__attribute">
                                    <dt className="ecc-silk-mapping__rulesviewer__attribute-label">
                                        Label
                                    </dt>
                                    <dd className="ecc-silk-mapping__rulesviewer__attribute-info">
                                        {_.get(
                                            this.props,
                                            'metadata.label',
                                            ''
                                        )}
                                    </dd>
                                </dl>
                            </div>
                        ) : (
                            false
                        )}
                        {_.get(this, 'props.metadata.description', false) ? (
                            <div className="ecc-silk-mapping__rulesviewer__comment">
                                <dl className="ecc-silk-mapping__rulesviewer__attribute">
                                    <dt className="ecc-silk-mapping__rulesviewer__attribute-label">
                                        Description
                                    </dt>
                                    <dd className="ecc-silk-mapping__rulesviewer__attribute-info">
                                        {this.props.metadata.description}
                                    </dd>
                                </dl>
                            </div>
                        ) : (
                            false
                        )}
                    </CardContent>
                    <CardActions className="ecc-silk-mapping__ruleseditor__actionrow">
                        <Button
                            className="ecc-silk-mapping__ruleseditor__actionrow-edit"
                            raised
                            onClick={this.handleEdit}
                        >
                            Edit
                        </Button>
                        <Button
                            className="ecc-silk-mapping__ruleseditor__actionrow-copy"
                            raised
                            onClick={this.handleCopy}
                        >
                            Copy
                        </Button>
                        <Button
                            className="ecc-silk-mapping__ruleseditor__actionrow-clone"
                            raised
                            onClick={this.handleClone}
                        >
                            Clone
                        </Button>
                        <DisruptiveButton
                            className="ecc-silk-mapping__ruleseditor__actionrow-remove"
                            raised
                            onClick={() =>
                                this.props.onClickedRemove({
                                    id: this.props.id,
                                    uri: this.props.mappingTarget.uri,
                                    type: this.props.type,
                                    parent: this.props.parentId,
                                })
                            }
                            disabled={false}
                        >
                            Remove
                        </DisruptiveButton>
                    </CardActions>
                </Card>
            </div>
        );
    }
}

export default RuleValueView;